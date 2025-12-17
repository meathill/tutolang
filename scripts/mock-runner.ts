import { runMockFromFile } from '@tutolang/core/mock';

async function main() {
  try {
    const res = await runMockFromFile('sample/hello-world.tutolang');
    console.log(res.text);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

void main();
