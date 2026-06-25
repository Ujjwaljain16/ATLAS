export * from './ToolRuntime';
export * from './types';
export * from './tools/SendKeys';
export * from './tools/OpenBrowser';
export * from './tools/Navigate';
export * from './tools/ClickOnScreen';
export * from './tools/Scroll';
export * from './tools/DoubleClick';
export * from './tools/TakeScreenshot';
export * from './tools/SelectOption';
export * from './tools/Wait';
export * from './tools/Hover';
export * from './tools/PressKey';
export * from './tools/GoBack';
export * from './tools/GoForward';
export * from './tools/Drag';
export * from './tools/KeyChord';
export * from './tools/Copy';
export * from './tools/Paste';
export * from './tools/SetSliderValue';
export * from './tools/ExtractText';
export * from './tools/ReadChunk';

import { NavigateTool } from './tools/Navigate';
import { ClickOnScreenTool } from './tools/ClickOnScreen';
import { SendKeysTool } from './tools/SendKeys';
import { WaitTool } from './tools/Wait';
import { WaitUntilTool } from './tools/WaitUntil';
import { ExtractTextTool } from './tools/ExtractText';
import { ReadChunkTool } from './tools/ReadChunk';
import { ToolRuntime } from './ToolRuntime';

export function setupDefaultTools(): ToolRuntime {
  const runtime = new ToolRuntime();
  
  runtime.register(new NavigateTool());
  runtime.register(new ClickOnScreenTool());
  runtime.register(new SendKeysTool());
  runtime.register(new WaitTool());
  runtime.register(new WaitUntilTool());
  runtime.register(new ExtractTextTool());
  runtime.register(new ReadChunkTool());
  
  return runtime;
}
