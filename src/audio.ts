//
// gvasm - Assembler and disassembler for Game Boy Advance homebrew
// by Sean Connelly (@velipso), https://sean.fun
// Project Home: https://github.com/velipso/gvasm
// SPDX-License-Identifier: 0BSD
//

export interface IAudio {
  sampleRate: number;
  channels: number[][];
}

export function loadAudio(data: Uint8Array): IAudio | string {
  try {
    let di = 0;
    const u8 = () => {
      if (di >= data.length) {
        throw 'Unexpected end of data';
      }
      const res = data[di];
      di++;
      return res;
    };
    const u16 = () => {
      const a = u8();
      const b = u8();
      return (b * (1 << 8)) + a;
    };
    const i16 = () => {
      const a = u16();
      return a >= (1 << 15) ? a - (1 << 16) : a;
    };
    const u32 = () => {
      const a = u8();
      const b = u8();
      const c = u8();
      const d = u8();
      return (d * (1 << 24)) + (c * (1 << 16)) + (b * (1 << 8)) + a;
    };

    if (u32() !== 0x46464952) { // 'RIFF'
      throw 'Bad header';
    }
    u32(); // size
    if (u32() !== 0x45564157) { // 'WAVE'
      throw 'Bad header';
    }

    while (true) {
      const type = u32();
      if (type === 0x20746d66) { // 'fmt '
        const fmtSize = u32();
        if (fmtSize !== 16) {
          throw `Unsupported format size; only basic 8 or 16 bit supported`;
        }
        const fmt = u16();
        if (fmt !== 1) {
          throw `Unsupported format; only basic 8 or 16 bit supported`;
        }
        const channelCount = u16();
        const sampleRate = u32();
        u32(); // bytes per second
        u16(); // alignment
        const bits = u16();
        if (bits !== 8 && bits !== 16) {
          throw `Unsupported bit depth of $bits; only 8 or 16 bit supported`;
        }
        while (true) {
          const type2 = u32();
          if (type2 === 0x61746164) { // 'data'
            const size = u32();
            const channels: number[][] = [];
            for (let ch = 0; ch < channelCount; ch++) {
              channels.push([]);
            }
            const sampleCount = size * 8 / (bits * channelCount);
            for (let i = 0; i < sampleCount; i++) {
              for (let ch = 0; ch < channelCount; ch++) {
                let sample = 0;
                switch (bits) {
                  case 8: {
                    sample = u8() - 128;
                    sample = sample < 0 ? sample / 128 : sample / 127;
                    break;
                  }
                  case 16: {
                    sample = i16();
                    sample = sample < 0 ? sample / 32768 : sample / 32767;
                    break;
                  }
                }
                channels[ch].push(sample);
              }
            }
            return { sampleRate, channels };
          }
        }
      }
    }
  } catch (e) {
    if (typeof e === 'string') {
      return e;
    }
    throw e;
  }
}
