import * as fs from 'fs';
import * as path from 'path';
import {test} from '@jest/globals';

export interface TestCase {
  name: string;
  sections: Record<string, string>;
}

/**
 * Parse a Test::Base style .cases file
 * 
 * Format:
 * === TEST name
 * --- section1
 * content1
 * --- section2
 * content2
 */
export function parseCasesFile(filePath: string): TestCase[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const testCases: TestCase[] = [];
  
  // Split by test case separator (=== or ### for compatibility)
  const testBlocks = content.split(/^(===|###)\s*/m).filter(block => block.trim() && block !== '===' && block !== '###');
  
  for (const block of testBlocks) {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();
    
    // Parse test name from first line (e.g., "TEST 1: say something" or "TEST1: line comment")
    const nameMatch = firstLine.match(/^TEST\s*\d*:\s*(.+)/i);
    if (!nameMatch) {
      continue;
    }
    
    const name = nameMatch[1].trim();
    const sections: Record<string, string> = {};
    
    let currentSection: string | null = null;
    let currentContent: string[] = [];
    
    // Parse sections starting from line 1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this is a section header
      if (line.match(/^---\s+\w+/)) {
        // Save previous section if exists
        if (currentSection !== null) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        
        // Start new section
        const sectionMatch = line.match(/^---\s+(\w+)/);
        if (sectionMatch) {
          currentSection = sectionMatch[1];
          currentContent = [];
        }
      } else if (currentSection !== null) {
        // Add line to current section
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection !== null) {
      sections[currentSection] = currentContent.join('\n').trim();
    }
    
    testCases.push({ name, sections });
  }
  
  return testCases;
}

/**
 * Load all .cases files from a directory
 */
export function loadCasesFromDir(dirPath: string): Record<string, TestCase[]> {
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.cases'));
  const result: Record<string, TestCase[]> = {};
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const baseName = path.basename(file, '.cases');
    result[baseName] = parseCasesFile(filePath);
  }
  
  return result;
}

/**
 * Run tests for a set of test cases
 * This is the main test scaffold function
 */
export function runTestCases(
  testCases: TestCase[],
  testFn: (testCase: TestCase) => void | Promise<void>
): void {
  for (const testCase of testCases) {
    test(testCase.name, async () => {
      await testFn(testCase);
    });
  }
}
