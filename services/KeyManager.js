import ApiKey from '../models/ApiKey.js';
import { logKeyEvent, logError } from './logger.js';

class KeyManager {
  constructor() {
    this.currentKey = null;
  }

  async initialize() {
    if (!this.currentKey) {
      await this.rotateKey();
    }
  }

  async rotateKey() {
    try {
      // Get a working key that's not in cooldown
      // Get all keys and filter/sort manually
      const keys = await ApiKey.findAll({
        isActive: true,
        $or: [
          { rateLimitResetAt: null },
          { rateLimitResetAt: { $lte: new Date() } }
        ]
      });

      // Sort by lastUsed ascending (oldest first)
      const key = keys.sort((a, b) => {
        if (!a.lastUsed) return -1;
        if (!b.lastUsed) return 1;
        return new Date(a.lastUsed) - new Date(b.lastUsed);
      })[0];

      if (!key) {
        const error = new Error('No available API keys');
        logError(error);
        throw error;
      }

      this.currentKey = key;
      
      // Log key rotation
      logKeyEvent('Key Rotation', {
        keyId: key._id,
        lastUsed: key.lastUsed,
        failureCount: key.failureCount
      });

      return key.key;
    } catch (error) {
      logError(error, { action: 'rotateKey' });
      throw error;
    }
  }

  async markKeySuccess() {
    if (this.currentKey) {
      try {
        this.currentKey.lastUsed = new Date();
        await this.currentKey.save();
        logKeyEvent('Key Success', {
          keyId: this.currentKey._id,
          lastUsed: this.currentKey.lastUsed
        });
      } catch (error) {
        logError(error, { action: 'markKeySuccess' });
      }
    }
  }

  async markKeyError(error, responseData) {
    if (!this.currentKey) return;

    try {
      const statusCode = error.response?.status;
      const errorMessage = responseData?.error?.message || '';
      const isStatusRateLimit = statusCode === 429;
      const isMessageRateLimit = errorMessage.toLowerCase().includes('rate limit');
      const isTriggerCondition = isStatusRateLimit || isMessageRateLimit;

      // Log dettagliato dell'errore ricevuto
      logKeyEvent('Error Analysis', {
        keyId: this.currentKey._id,
        statusCode,
        errorMessage,
        isStatusRateLimit,
        isMessageRateLimit,
        headers: error.response?.headers
      });

      if (isTriggerCondition) {
        // Set reset time based on headers or default to 60 seconds
        const resetTime = isStatusRateLimit ? error.response.headers['x-ratelimit-reset'] : null;
        const resetDate = resetTime
          ? new Date(resetTime * 1000)
          : new Date(Date.now() + 60000);
        
        this.currentKey.rateLimitResetAt = resetDate;
        
        logKeyEvent('Rate Limit Detected', {
          keyId: this.currentKey._id,
          resetTime: this.currentKey.rateLimitResetAt,
          statusCode,
          message: errorMessage,
          trigger: isStatusRateLimit ? 'status_429' : 'message_match'
        });

        await this.currentKey.save();
        // Clear current key to force rotation
        this.currentKey = null;
        return true; // Indicate it was a rate limit condition
      }

      this.currentKey.failureCount += 1;
      
      // If too many failures, deactivate the key
      if (this.currentKey.failureCount >= 5) {
        this.currentKey.isActive = false;
        logKeyEvent('Key Deactivated', {
          keyId: this.currentKey._id,
          reason: 'Too many failures',
          failureCount: this.currentKey.failureCount,
          lastError: errorMessage
        });
        // Clear current key to force rotation
        this.currentKey = null;
      }

      await this.currentKey.save();
      return false; // Indicate it was not a rate limit condition
    } catch (error) {
      logError(error, {
        action: 'markKeyError',
        keyId: this.currentKey?._id
      });
      return false;
    }
  }

  async getKey() {
    try {
      // If we have a current key and it's not in cooldown, keep using it
      if (this.currentKey) {
        const now = new Date();
        if (!this.currentKey.rateLimitResetAt || this.currentKey.rateLimitResetAt <= now) {
          return this.currentKey.key;
        }
      }
      
      // Otherwise rotate to a new key
      return await this.rotateKey();
    } catch (error) {
      logError(error, { action: 'getKey' });
      throw error;
    }
  }

  async addKey(key) {
    try {
      const existingKey = await ApiKey.findOne({ key });
      if (existingKey) {
        existingKey.isActive = true;
        existingKey.failureCount = 0;
        existingKey.rateLimitResetAt = null;
        await existingKey.save();

        logKeyEvent('Key Reactivated', {
          keyId: existingKey._id
        });

        return existingKey;
      }

      const newKey = await ApiKey.create({ key });
      logKeyEvent('New Key Added', {
        keyId: newKey._id
      });

      return newKey;
    } catch (error) {
      logError(error, { action: 'addKey' });
      throw error;
    }
  }
}

export default new KeyManager();