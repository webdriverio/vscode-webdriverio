import { LoggerService } from '../services/logger';
import { plugin } from '../constants';

export function showOutput() {
  LoggerService.get().show();
}

showOutput.command = `${plugin}.showOutput`;
