/** Stops every track of `stream`, which releases the camera and the microphone. */
export const stopTracks = (stream: MediaStream): void => {
  for (const track of stream.getTracks()) track.stop();
};
