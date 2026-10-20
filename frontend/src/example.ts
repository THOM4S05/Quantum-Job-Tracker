import manifest from './data/exampleManifest.json';
import { homeHref } from './environment';
export const example = manifest;
export const exampleQuery = new URLSearchParams({ view: 'comparison', experiment: example.id, baseline: example.baseline, candidate: example.candidate }).toString();
export const exampleHref = `${homeHref}?${exampleQuery}`;
