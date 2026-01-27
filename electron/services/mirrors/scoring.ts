type MirrorScore = {
  samples: number;
  avgLatency: number;
  failures: number;
  lastFailure?: number;
  lastSuccess?: number;
};

const mirrorScores = new Map<string, MirrorScore>();

const getOrigin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
};

export const reportMirrorSuccess = (url: string, latencyMs: number) => {
  const origin = getOrigin(url);
  const score = mirrorScores.get(origin) ?? { samples: 0, avgLatency: 0, failures: 0 };
  const samples = score.samples + 1;
  const avgLatency = samples === 1 ? latencyMs : (score.avgLatency * score.samples + latencyMs) / samples;
  mirrorScores.set(origin, { ...score, samples, avgLatency, lastSuccess: Date.now() });
};

export const reportMirrorFailure = (url: string) => {
  const origin = getOrigin(url);
  const score = mirrorScores.get(origin) ?? { samples: 0, avgLatency: 0, failures: 0 };
  mirrorScores.set(origin, { ...score, failures: score.failures + 1, lastFailure: Date.now() });
};

export const orderCandidatesByScore = (urls: string[]) => {
  const ranked = urls.map((url, index) => {
    const origin = getOrigin(url);
    const score = mirrorScores.get(origin);
    const avgLatency = score?.avgLatency ?? 5000;
    const failures = score?.failures ?? 0;
    return { url, index, rank: avgLatency + failures * 10000 };
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.map((item) => item.url);
};

