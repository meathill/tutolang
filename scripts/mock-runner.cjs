require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'ESNext',
    moduleResolution: 'NodeNext',
  },
});

(async () => {
  try {
    const { runMockFromFile } = await import('../packages/core/mock.ts');
    const res = await runMockFromFile('sample/hello-world.tutolang');
    console.log(res.text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
