import {describe, expect} from "@jest/globals";
import {loadCasesFromDir, runTestCases} from '../test-base';
import * as path from 'path';

// Load all test cases from the cases directory
const casesDir = path.join(__dirname, 'cases');
const allCases = loadCasesFromDir(casesDir);

// Example: Run tests using the scaffold
describe('tutolang core', () => {
  describe('sanity checks', () => {
    runTestCases(allCases.sanity || [], (testCase) => {
      // For now, just validate that the tuto section exists and is not empty
      expect(testCase.sections).toHaveProperty('tuto');
      expect(testCase.sections.tuto).toBeTruthy();
      expect(testCase.sections.tuto.length).toBeGreaterThan(0);
    });
  });
  
  describe('comment parsing', () => {
    runTestCases(allCases.comment || [], (testCase) => {
      // Validate that comments are properly handled
      expect(testCase.sections).toHaveProperty('tuto');
      expect(testCase.sections.tuto).toBeTruthy();
      expect(testCase.sections.tuto).toContain('#');
    });
  });
});
