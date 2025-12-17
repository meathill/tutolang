# Test Scaffold (Test::Base for Jest)

A Test::Base-like testing framework for Jest that separates test data from test logic, making tests easier to read and maintain.

## Overview

This test scaffold allows you to write test cases in simple `.cases` files with a clean, readable format inspired by Perl's Test::Base. The test data is stored separately from the test logic, making it easy to:

- Add new test cases without changing code
- Read and understand test inputs/outputs at a glance
- Maintain large test suites with minimal code duplication

## File Format

Test cases are written in `.cases` files with the following format:

```
=== TEST 1: test name here
--- section_name
section content
can span multiple lines
--- another_section
more content

=== TEST 2: another test
--- section_name
different content
```

### Format Rules:

- `===` or `###` marks the start of a new test case (followed by `TEST` and test name)
- `---` marks the start of a section within a test case
- Test names follow the format: `TEST <number>: <description>` or `TEST<number>: <description>`
- Everything between section markers becomes the section content (trimmed)

## Usage

### 1. Create `.cases` Files

Create your test data files in a `cases/` directory:

```
tests/
  core/
    cases/
      sanity.cases
      comment.cases
    index.test.ts
```

Example `sanity.cases`:
```
=== TEST 1: say something
--- tuto
say(image=/path/to/photo):
    hi, I'm Tutolang, let's make some movie
```

### 2. Write Test Files

Use the test scaffold in your Jest test files:

```typescript
import {describe, expect} from "@jest/globals";
import {loadCasesFromDir, runTestCases} from '../test-base';
import * as path from 'path';

// Load all test cases from the cases directory
const casesDir = path.join(__dirname, 'cases');
const allCases = loadCasesFromDir(casesDir);

describe('my feature', () => {
  describe('sanity checks', () => {
    runTestCases(allCases.sanity || [], (testCase) => {
      // testCase.name contains the test name
      // testCase.sections contains all sections as key-value pairs
      
      expect(testCase.sections.tuto).toBeTruthy();
      // Add your test logic here
    });
  });
});
```

## API

### `parseCasesFile(filePath: string): TestCase[]`

Parses a single `.cases` file and returns an array of test cases.

**Parameters:**
- `filePath`: Absolute path to the `.cases` file

**Returns:** Array of `TestCase` objects

### `loadCasesFromDir(dirPath: string): Record<string, TestCase[]>`

Loads all `.cases` files from a directory.

**Parameters:**
- `dirPath`: Absolute path to the directory containing `.cases` files

**Returns:** Object mapping file names (without `.cases` extension) to arrays of test cases

### `runTestCases(testCases: TestCase[], testFn: (testCase: TestCase) => void | Promise<void>): void`

Generates Jest tests from an array of test cases.

**Parameters:**
- `testCases`: Array of test cases to run
- `testFn`: Function that contains your test logic. Receives a `TestCase` object as parameter.

### `TestCase` Interface

```typescript
interface TestCase {
  name: string;                      // Test name from the === line
  sections: Record<string, string>;  // Map of section names to content
}
```

## Benefits

1. **Separation of Concerns**: Test data is separated from test logic
2. **Easy to Read**: Test cases in `.cases` files are simple and human-readable
3. **Easy to Maintain**: Adding new test cases is as simple as adding text to a file
4. **No Code Duplication**: Test logic is written once and applied to all test cases
5. **Flexible**: Each test case can have different sections based on your needs

## Examples

See `tests/core/` for working examples:
- `cases/sanity.cases` - Simple test case
- `cases/comment.cases` - Multiple test cases with different scenarios
- `index.test.ts` - Example usage of the test scaffold
- `test-base.test.ts` - Tests for the scaffold itself

## Comparison with Regular Jest Tests

**Before (Regular Jest):**
```typescript
describe('comments', () => {
  test('line comment', () => {
    const input = '# hello world';
    // ... test logic
  });
  
  test('block comment', () => {
    const input = '#{\n    hello world\n}';
    // ... test logic
  });
  
  // ... more repetitive test code
});
```

**After (Test Scaffold):**

`comment.cases`:
```
=== TEST1: line comment
--- tuto
# hello world

=== TEST2: block comment
--- tuto
#{
    hello world
}
```

`test.ts`:
```typescript
runTestCases(allCases.comment, (testCase) => {
  // Write test logic once, applies to all cases
  const result = parse(testCase.sections.tuto);
  expect(result).toBeTruthy();
});
```

Much cleaner and easier to maintain!
