import ReactTestRenderer from 'react-test-renderer';
import {FakeSpeechRecognitionAdapter} from '../app/infrastructure/speech/FakeSpeechRecognitionAdapter';
import {useSpeechRecognition} from '../app/presentation/hooks/useSpeechRecognition';

type HookState = ReturnType<typeof useSpeechRecognition>;

function HookProbe({
  port,
  onState,
}: {
  port: FakeSpeechRecognitionAdapter;
  onState: (state: HookState) => void;
}) {
  const state = useSpeechRecognition({port, language: 'fr'});
  onState(state);
  return null;
}

test('useSpeechRecognition updates partial and final transcripts', async () => {
  const port = new FakeSpeechRecognitionAdapter();
  let latest: HookState | undefined;

  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <HookProbe
        port={port}
        onState={state => {
          latest = state;
        }}
      />,
    );
  });

  expect(latest).toBeDefined();

  await ReactTestRenderer.act(async () => {
    await latest!.start();
  });

  expect(latest!.isListening).toBe(true);

  await ReactTestRenderer.act(() => {
    port.emit({type: 'partial', text: 'bonjour'});
  });
  expect(latest!.partialTranscript).toBe('bonjour');

  await ReactTestRenderer.act(() => {
    port.emit({type: 'final', text: 'bonjour', speakerLabel: 'Locuteur 1'});
  });
  expect(latest!.finalTranscript).toBe('Locuteur 1: bonjour');
  expect(latest!.finalSegments).toEqual([
    {text: 'bonjour', speakerLabel: 'Locuteur 1'},
  ]);
  expect(latest!.transcriptBlocks).toHaveLength(1);
  expect(latest!.partialTranscript).toBe('');
});

test('insertViewBreak keeps history and starts a fresh view', async () => {
  const port = new FakeSpeechRecognitionAdapter();
  let latest: HookState | undefined;

  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <HookProbe
        port={port}
        onState={state => {
          latest = state;
        }}
      />,
    );
  });

  await ReactTestRenderer.act(() => {
    port.emit({type: 'final', text: 'bonjour'});
  });

  await ReactTestRenderer.act(() => {
    latest!.insertViewBreak();
  });

  expect(latest!.finalSegments).toEqual([
    {text: 'bonjour', speakerLabel: null},
  ]);
  expect(latest!.transcriptBlocks).toEqual([
    expect.objectContaining({type: 'segment', text: 'bonjour'}),
    expect.objectContaining({type: 'break'}),
  ]);
});

test('useSpeechRecognition toggles speaker mode via port', async () => {
  const port = new FakeSpeechRecognitionAdapter();
  let latest: HookState | undefined;

  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(
      <HookProbe
        port={port}
        onState={state => {
          latest = state;
        }}
      />,
    );
  });

  await ReactTestRenderer.act(async () => {
    await latest!.setSpeakerMode(true);
  });

  expect(latest!.speakerMode).toBe(true);
  expect(await port.isSpeakerModeEnabled()).toBe(true);
});
