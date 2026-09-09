const ANSI = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

export type LogColor = keyof typeof ANSI;

export function colorize(text: string, color: LogColor | LogColor[]): string {
  const codes = Array.isArray(color) ? color : [color];
  const start = codes.map((c) => ANSI[c]).join('');
  return `${start}${text}${ANSI.reset}`;
}

export function colorForStatus(status: number): LogColor | LogColor[] {
  if (status >= 500) return ['red', 'bold'];
  if (status >= 400) return ['yellow'];
  if (status >= 300) return ['cyan'];
  if (status === 200) return ['green'];
  if (status === 201) return ['green'];
  return ['blue'];
}

export function methodColor(method: string): LogColor {
  switch (method) {
    case 'GET':
      return 'blue';
    case 'POST':
      return 'green';
    case 'PUT':
    case 'PATCH':
      return 'yellow';
    case 'DELETE':
      return 'red';
    default:
      return 'cyan';
  }
}