declare module 'bcrypt' {
  export function hash(s: string, saltOrRounds: number): Promise<string>;
  export function compare(s: string, hash: string): Promise<boolean>;
  export function genSalt(rounds?: number): Promise<string>;
  export function hashSync(s: string, saltOrRounds: number): string;
  export function compareSync(s: string, hash: string): boolean;
}
