class Pcm16ChunkerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.chunkSamples = 1600;
    this.resampleAccumulator = 0;
    this.sampleSum = 0;
    this.sampleCount = 0;
    this.chunk = new Int16Array(this.chunkSamples);
    this.chunkOffset = 0;
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    for (let index = 0; index < input.length; index += 1) {
      this.sampleSum += input[index];
      this.sampleCount += 1;
      this.resampleAccumulator += this.targetSampleRate;

      if (this.resampleAccumulator < sampleRate) continue;

      this.resampleAccumulator -= sampleRate;
      const averagedSample = this.sampleSum / this.sampleCount;
      const clampedSample = Math.max(-1, Math.min(1, averagedSample));
      this.chunk[this.chunkOffset] = clampedSample < 0
        ? Math.round(clampedSample * 0x8000)
        : Math.round(clampedSample * 0x7fff);
      this.chunkOffset += 1;
      this.sampleSum = 0;
      this.sampleCount = 0;

      if (this.chunkOffset === this.chunkSamples) {
        const buffer = this.chunk.buffer;
        this.port.postMessage(buffer, [buffer]);
        this.chunk = new Int16Array(this.chunkSamples);
        this.chunkOffset = 0;
      }
    }

    return true;
  }
}

registerProcessor('pcm16-chunker', Pcm16ChunkerProcessor);
