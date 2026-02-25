(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error("Run unsandboxed");
    }

    let synth;
    let currentPart;
    let currentMidi;
    let volumeNode;
    let isPlaying = false;

    async function loadScript(src) {
        return new Promise(resolve => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    async function ensureLibraries() {
        if (!window.Tone) {
            await loadScript("https://unpkg.com/tone@14.7.77/build/Tone.js");
        }
        if (!window.Midi) {
            await loadScript("https://unpkg.com/@tonejs/midi@2.0.27/build/Midi.js");
        }
    }

    class MidiSoundtrack {
        getInfo() {
            return {
                id: 'midisoundtrack',
                name: 'MIDI Soundtrack',
                blocks: [
                    {
                        opcode: 'loadMidi',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'load midi from [URL]',
                        arguments: {
                            URL: {
                                type: Scratch.ArgumentType.STRING,
                                defaultValue: ''
                            }
                        }
                    },
                    { opcode: 'playMidi', blockType: Scratch.BlockType.COMMAND, text: 'play midi' },
                    { opcode: 'stopMidi', blockType: Scratch.BlockType.COMMAND, text: 'stop midi' },
                    {
                        opcode: 'setVolume',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'set midi volume to [VOLUME] %',
                        arguments: {
                            VOLUME: {
                                type: Scratch.ArgumentType.NUMBER,
                                defaultValue: 100
                            }
                        }
                    }
                ]
            };
        }

        async loadMidi(args) {
            await ensureLibraries();
            await Tone.start();

            // Clean previous playback
            Tone.Transport.stop();
            Tone.Transport.cancel();
            isPlaying = false;

            if (currentPart) {
                currentPart.dispose();
            }

            if (!volumeNode) {
                volumeNode = new Tone.Volume(0).toDestination();
            }

            if (!synth) {
                // Limit polyphony to prevent glitching
                synth = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16
                }).connect(volumeNode);
            }

            const response = await fetch(args.URL);
            const buffer = await response.arrayBuffer();
            currentMidi = new Midi(buffer);

            // Apply MIDI tempo
            if (currentMidi.header.tempos.length > 0) {
                Tone.Transport.bpm.value =
                    currentMidi.header.tempos[0].bpm;
            }

            const events = [];

            currentMidi.tracks.forEach(track => {
                track.notes.forEach(note => {
                    events.push({
                        time: note.time,
                        name: note.name,
                        duration: note.duration,
                        velocity: note.velocity
                    });
                });
            });

            currentPart = new Tone.Part((time, note) => {
                synth.triggerAttackRelease(
                    note.name,
                    note.duration,
                    time,
                    note.velocity
                );
            }, events).start(0);

            Tone.Transport.position = 0;
        }

        playMidi() {
            if (!currentMidi || isPlaying) return;
            Tone.Transport.start();
            isPlaying = true;
        }

        stopMidi() {
            Tone.Transport.stop();
            Tone.Transport.position = 0;
            isPlaying = false;
        }

        setVolume(args) {
            if (!volumeNode) return;
            const percent = Math.max(0, Math.min(100, args.VOLUME));
            const gain = percent / 100;
            volumeNode.volume.value = Tone.gainToDb(gain);
        }
    }

    Scratch.extensions.register(new MidiSoundtrack());

})(Scratch);
