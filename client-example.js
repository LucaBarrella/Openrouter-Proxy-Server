import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',  // Point to our proxy server
  apiKey: 'dummy-key',  // The actual key management is handled by proxy
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'OpenRouterProxy',
  },
});

// Example with non-streaming response
async function nonStreamingExample() {
  try {
    console.log('\n=== Non-Streaming Example ===');
    const completion = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages: [
        {
          role: 'user',
          content: 'What is the meaning of life?',
        },
      ],
      stream: false,  // Explicitly disable streaming
    });
    
    console.log('Response:', completion.choices[0].message);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Example with streaming response
async function streamingExample() {
  try {
    console.log('\n=== Streaming Example ===');
    const stream = await openai.chat.completions.create({
      model: 'deepseek/deepseek-chat:free',
      messages: [
        {
          role: 'user',
          content: 'Write a short story about a robot learning to paint.',
        },
      ],
      stream: true,  // Enable streaming
    });

    console.log('Streaming response:');
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      process.stdout.write(content);
    }
    console.log('\n=== Stream Complete ===\n');
  } catch (error) {
    console.error('Stream Error:', error.message);
  }
}

// Run both examples
async function main() {
  await nonStreamingExample();
  await streamingExample();
}

main();