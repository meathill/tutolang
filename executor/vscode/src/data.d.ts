export interface OpenFileCommand {
  type: 'OpenFile';
  filePath: string;
  openFileOptions?: OpenFileOptions;
}

export interface OpenFileOptions {
  selectRange?: {
    startPosition: { row: number; col: number };
    endPosition: { row: number; col: number };
  };
  preview?: boolean;
  viewColumn?: number;
}

export interface InputCommand {
  type: 'Input';
  content: string;
  position: {
    row: number;
    col: number;
  };
}

export interface MoveCursorCommand {
  type: 'MoveCursor';
  toPosition?: {
    row: number;
    col: number;
  };
}
