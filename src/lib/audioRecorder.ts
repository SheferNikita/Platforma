const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

export function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'audio/webm';
  }
  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return '';
}

export function getBaseMimeType(mimeType: string): string {
  return mimeType.split(';')[0] || 'audio/webm';
}

export function getAudioDataUri(base64: string, mimeType?: string): string {
  const type = mimeType || detectMimeFromBase64(base64);
  return `data:${type};base64,${base64}`;
}

function detectMimeFromBase64(base64: string): string {
  if (!base64 || base64.length < 8) return 'audio/webm';
  try {
    const binaryStr = atob(base64.substring(0, 16));
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return 'audio/webm';
    }
    if (bytes.length >= 8) {
      const str = String.fromCharCode(...bytes.slice(4, 8));
      if (str === 'ftyp') return 'audio/mp4';
    }
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return 'audio/ogg';
    }
  } catch {}
  return 'audio/webm';
}

export function createMediaRecorder(stream: MediaStream): { recorder: MediaRecorder; mimeType: string } {
  const mimeType = getSupportedMimeType();
  const options: MediaRecorderOptions = {};
  if (mimeType) {
    options.mimeType = mimeType;
  }
  options.audioBitsPerSecond = 32000;
  const recorder = new MediaRecorder(stream, options);
  const actualMime = recorder.mimeType || mimeType || 'audio/webm';
  return { recorder, mimeType: getBaseMimeType(actualMime) };
}
