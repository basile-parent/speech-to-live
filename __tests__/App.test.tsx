/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../app/presentation/hooks/useSpeechRecognition', () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    partialTranscript: '',
    finalTranscript: '',
    finalSegments: [],
    transcriptBlocks: [],
    audioLevel: 0,
    error: null,
    speakerMode: false,
    setSpeakerMode: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    insertViewBreak: jest.fn(),
    clearTranscript: jest.fn(),
  }),
}));

import App from '../App';

test('renders the speech screen', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
