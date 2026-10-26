export { CameraSourceTypes, type ModeCameraType } from '../../abstract/cameraModes';

export const CameraSourceEvents = Object.freeze({
  IDLE: 'idle',
  SHOT: 'shot',

  PLAY: 'play',
  PAUSE: 'pause',
  RESUME: 'resume',
  STOP: 'stop',

  RETAKE: 'retake',
  ACCEPT: 'accept',
});
