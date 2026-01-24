export interface IScriptGenerator {
  generateScript(topic: string): Promise<string>;
}
