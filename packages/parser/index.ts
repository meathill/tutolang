import { AST, ASTNode } from '@tutolang/types';

export class Lexer {
  private code: string;
  private position: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(code: string) {
    this.code = code;
  }

  tokenize(): Token[] {
    // TODO: Implement lexical analysis
    return [];
  }

  private nextChar(): string | null {
    // TODO: Get next character
    return null;
  }

  private peek(offset: number = 0): string | null {
    // TODO: Peek ahead
    return null;
  }
}

export class Parser {
  private tokens: Token[];
  private position: number = 0;

  constructor(code: string) {
    const lexer = new Lexer(code);
    this.tokens = lexer.tokenize();
  }

  parse(): AST {
    // TODO: Implement syntax analysis
    return [];
  }

  private parseSay(): ASTNode | null {
    // TODO: Parse say statement
    return null;
  }

  private parseFile(): ASTNode | null {
    // TODO: Parse file statement
    return null;
  }

  private parseBrowser(): ASTNode | null {
    // TODO: Parse browser statement
    return null;
  }

  private parseCommit(): ASTNode | null {
    // TODO: Parse commit statement
    return null;
  }

  private parseMarkers(): any[] {
    // TODO: Parse markers like [start], [l1], etc
    return [];
  }
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export enum TokenType {
  Keyword = 'keyword',
  Identifier = 'identifier',
  String = 'string',
  Number = 'number',
  Indent = 'indent',
  Newline = 'newline',
  Comment = 'comment',
  EOF = 'eof',
}
