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
    port.emit({type: 'final', text: 'bonjour'});
  });
  expect(latest!.finalTranscript).toBe('bonjour');
  expect(latest!.partialTranscript).toBe('');
});
