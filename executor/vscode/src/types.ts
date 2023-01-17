export enum CommandType {
  OpenFile = 'OpenFile',
  Input = 'Input',
  MoveCursor = 'MoveCursor',
}

export interface Position {
  row: number;
  col: number;
}

export interface Command {
  type: CommandType;
}

export interface OpenFileCommand extends Command {
  type: CommandType.OpenFile;
  filePath: string;
  openFileOptions?: OpenFileOptions;
}

export interface OpenFileOptions {
  selectRange?: {
    startPosition: Position;
    endPosition: Position;
  };
  preview?: boolean;
  viewColumn?: number;
}

export interface InputCommand extends Command {
  type: CommandType.Input;
  content: string;
  position: Position;
}

export interface MoveCursorCommand extends Command {
  type: CommandType.MoveCursor;
  toPosition: Position;
}
