import {describe, expect, test} from "@jest/globals";
import {parseCasesFile, loadCasesFromDir, runTestCases} from '../test-base';
import * as path from 'path';

describe('test-base parser', () => {
  test('should parse sanity.cases correctly', () => {
    const casesPath = path.join(__dirname, 'cases/sanity.cases');
    const testCases = parseCasesFile(casesPath);
    
    expect(testCases).toHaveLength(1);
    expect(testCases[0].name).toBe('say something');
    expect(testCases[0].sections.tuto).toContain('say(image=/path/to/photo)');
  });
  
  test('should parse comment.cases correctly', () => {
    const casesPath = path.join(__dirname, 'cases/comment.cases');
    const testCases = parseCasesFile(casesPath);
    
    expect(testCases.length).toBeGreaterThanOrEqual(3);
    expect(testCases[0].name).toBe('line comment');
    expect(testCases[1].name).toBe('block comment');
  });
  
  test('should load all cases from directory', () => {
    const casesDir = path.join(__dirname, 'cases');
    const allCases = loadCasesFromDir(casesDir);
    
    expect(allCases).toHaveProperty('sanity');
    expect(allCases).toHaveProperty('comment');
    expect(allCases.sanity).toHaveLength(1);
  });
});

describe('test scaffold with cases', () => {
  const casesDir = path.join(__dirname, 'cases');
  const allCases = loadCasesFromDir(casesDir);
  
  describe('sanity', () => {
    runTestCases(allCases.sanity, (testCase) => {
      // Simple validation - just check that tuto section exists
      expect(testCase.sections).toHaveProperty('tuto');
      expect(testCase.sections.tuto).toBeTruthy();
    });
  });
  
  describe('comment', () => {
    runTestCases(allCases.comment, (testCase) => {
      // Simple validation - just check that tuto section exists
      expect(testCase.sections).toHaveProperty('tuto');
      expect(testCase.sections.tuto).toBeTruthy();
    });
  });
});
