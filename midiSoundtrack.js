(function (Scratch) {
    'use strict';

    if (!Scratch.extensions.unsandboxed) {
        throw new Error("This extension must be run unsandboxed");
    }

    let audioContext = null;
    let synth = null;
    let currentPart = null;
    let currentMidi = null;
    let volumeNode = null;

    async function loadTone() {
        if (!window.Tone) {
            await new Promise(resolve => {
                const script = document.createElement("script");
                script.src = "https://unpkg.com/tone@14.7.77/build/Tone.js";
                script.onload = resolve;
                document.head.appendChild(script);
            });
        }
    }

    async function loadMidiParser() {
        if (!window.Midi) {
            await new Promise(resolve => {
                const script = document.createElement("script");
                script.src = "https://unpkg.com/@tonejs/midi@2.0.27/build/Midi.js";
                script.onload = resolve;
                document.head.appendChild(script);
            });
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
                                defaultValue: 'https://example.com/file.mid'
                            }
                        }
                    },
                    {
                        opcode: 'playMidi',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'play midi'
                    },
                    {
                        opcode: 'stopMidi',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'stop midi'
                    },
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
            await loadTone();
            await loadMidiParser();

            if (!audioContext) {
                await Tone.start();
                audioContext = Tone.context;
                volumeNode = new Tone.Volume(0).toDestination();
                synth = new Tone.PolySynth(Tone.Synth).connect(volumeNode);
            }

            const response = await fetch(args.URL);
            const arrayBuffer = await response.arrayBuffer();
            currentMidi = new Midi(arrayBuffer);

            if (currentPart) {
                currentPart.dispose();
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

            currentPart = new Tone.Part((time, value) => {
                synth.triggerAttackRelease(
                    value.name,
                    value.duration,
                    time,
                    value.velocity
                );
            }, events).start(0);

            Tone.Transport.stop();
        }

        playMidi() {
            if (!currentMidi) return;
            Tone.Transport.start();
        }

        stopMidi() {
            Tone.Transport.stop();
        }

        setVolume(args) {
            if (!volumeNode) return;
            const vol = (args.VOLUME / 100) * 0; 
            volumeNode.volume.value = Tone.gainToDb(args.VOLUME / 100);
        }
    }

    Scratch.extensions.register(new MidiSoundtrack());

})(Scratch);
