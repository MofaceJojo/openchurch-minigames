/* Holy Bubbles · BGM 音序数据（圣诞快板风格，Jingle Bells 变奏）
   供 audio.js 合成器读取，无版权风险。
   结构：tracks[]，每轨 { instrument, notes:[{pitch, time, dur, vel}] }
   pitch: MIDI 音高 (69=A4=440Hz)
   time: 起始拍（4分音符=1拍）
   dur:  长度（拍）
   vel:  力度 0-1
   tempo: 160 BPM（快板）
   swing: 0.12（轻微摇摆）
*/

var AudioData = (function(){
  var TEMPO = 160;           // BPM
  var BEAT = 60 / TEMPO;     // 秒/拍
  var SWING = 0.12;          // 摇摆比例

  // 乐器音色参数
  var INST = {
    bell:   { type:"sine",   harm:[1, 2.5, 4],   gain:0.18, attack:0.005, decay:0.35, sustain:0.15, release:0.8 },
    synth:  { type:"square", harm:[1, 3, 5],    gain:0.12, attack:0.01,  decay:0.2,  sustain:0.3,  release:0.25 },
    bass:   { type:"triangle",harm:[1, 2],      gain:0.22, attack:0.02,  decay:0.15, sustain:0.4,  release:0.3 },
    perc:   { type:"noise",  gain:0.1,  attack:0.001, decay:0.08, sustain:0, release:0.1 },
    chime:  { type:"sine",   harm:[1, 2, 3, 4, 5, 6], gain:0.15, attack:0.003, decay:0.4, sustain:0.1, release:1.2 }
  };

  // 主旋律：Jingle Bells 变奏（C 大调，简化 8 小节循环）
  // 节奏：♪ ♫ ♪ ♫ | ♩ ♩ ♩ ♩ | ♪ ♫ ♪ ♫ | ♩ ♩ ♩ ♩ ...
  var melody = [
    // 小节 1-2: Jingle bells, jingle bells
    {pitch:76, time:0,   dur:0.5, vel:0.9}, // E5
    {pitch:76, time:0.5, dur:0.5, vel:0.8}, // E5
    {pitch:76, time:1,   dur:1,   vel:1.0}, // E5
    {pitch:76, time:2,   dur:0.5, vel:0.9},
    {pitch:76, time:2.5, dur:0.5, vel:0.8},
    {pitch:76, time:3,   dur:1,   vel:1.0},
    // 小节 3-4: Jingle all the way
    {pitch:76, time:4,   dur:0.5, vel:0.9},
    {pitch:79, time:4.5, dur:0.5, vel:0.8}, // G5
    {pitch:72, time:5,   dur:0.5, vel:0.7}, // C5
    {pitch:74, time:5.5, dur:0.5, vel:0.7}, // D5
    {pitch:76, time:6,   dur:2,   vel:1.0}, // E5 (长音)
    // 小节 5-6: Oh what fun it is to ride
    {pitch:79, time:8,   dur:0.5, vel:0.9}, // G5
    {pitch:79, time:8.5, dur:0.5, vel:0.8},
    {pitch:79, time:9,   dur:0.5, vel:0.8},
    {pitch:79, time:9.5, dur:0.5, vel:0.7},
    {pitch:77, time:10,  dur:0.5, vel:0.8}, // F5
    {pitch:77, time:10.5,dur:0.5, vel:0.7},
    {pitch:77, time:11,  dur:0.5, vel:0.7},
    {pitch:77, time:11.5,dur:0.5, vel:0.6},
    // 小节 7-8: In a one-horse open sleigh
    {pitch:76, time:12,  dur:0.5, vel:0.9},
    {pitch:76, time:12.5,dur:0.5, vel:0.8},
    {pitch:76, time:13,  dur:0.5, vel:0.7},
    {pitch:76, time:13.5,dur:0.5, vel:0.7},
    {pitch:74, time:14,  dur:0.5, vel:0.8}, // D5
    {pitch:74, time:14.5,dur:0.5, vel:0.7},
    {pitch:72, time:15,  dur:0.5, vel:0.7}, // C5
    {pitch:71, time:15.5,dur:0.5, vel:0.6}, // B4
    // 反行：回到主题
    {pitch:76, time:16,  dur:0.5, vel:0.9},
    {pitch:76, time:16.5,dur:0.5, vel:0.8},
    {pitch:79, time:17,  dur:0.5, vel:0.8},
    {pitch:77, time:17.5,dur:0.5, vel:0.7},
    {pitch:74, time:18,  dur:0.5, vel:0.8},
    {pitch:72, time:18.5,dur:0.5, vel:0.7},
    {pitch:71, time:19,  dur:1,   vel:0.9},
    {pitch:72, time:20,  dur:2,   vel:0.8}, // C5 结束留白
  ];

  // 贝斯线：根音 + 五度，半音律动
  var bass = [
    {pitch:48, time:0,  dur:1, vel:0.8}, // C3
    {pitch:48, time:1,  dur:1, vel:0.6},
    {pitch:48, time:2,  dur:1, vel:0.8},
    {pitch:48, time:3,  dur:1, vel:0.6},
    {pitch:43, time:4,  dur:1, vel:0.8}, // G2
    {pitch:43, time:5,  dur:1, vel:0.6},
    {pitch:41, time:6,  dur:1, vel:0.8}, // F2
    {pitch:43, time:7,  dur:1, vel:0.6},
    {pitch:48, time:8,  dur:1, vel:0.8},
    {pitch:48, time:9,  dur:1, vel:0.6},
    {pitch:48, time:10, dur:1, vel:0.8},
    {pitch:48, time:11, dur:1, vel:0.6},
    {pitch:43, time:12, dur:1, vel:0.8},
    {pitch:43, time:13, dur:1, vel:0.6},
    {pitch:41, time:14, dur:1, vel:0.8},
    {pitch:43, time:15, dur:1, vel:0.6},
    {pitch:48, time:16, dur:1, vel:0.8},
    {pitch:48, time:17, dur:1, vel:0.6},
    {pitch:48, time:18, dur:1, vel:0.8},
    {pitch:48, time:19, dur:1, vel:0.6},
    {pitch:48, time:20, dur:2, vel:0.7},
    {pitch:48, time:22, dur:2, vel:0.6},
  ];

  // 和弦填充：切分和弦（电子琴风格）
  var chord = [
    // Cmaj7
    {pitch:[60,64,67,71], time:0.5,  dur:1.5, vel:0.35},
    {pitch:[60,64,67,71], time:2.5,  dur:1.5, vel:0.3},
    // G7
    {pitch:[55,59,62,65], time:4.5,  dur:1.5, vel:0.35},
    {pitch:[55,59,62,65], time:6.5,  dur:1.5, vel:0.3},
    // Fmaj7
    {pitch:[53,57,60,64], time:8.5,  dur:1.5, vel:0.35},
    {pitch:[53,57,60,64], time:10.5, dur:1.5, vel:0.3},
    // C - G/B - Am - G
    {pitch:[60,64,67],    time:12.5, dur:1.5, vel:0.35},
    {pitch:[55,59,62],    time:14.5, dur:1.5, vel:0.3},
    {pitch:[57,60,64],    time:16.5, dur:1.5, vel:0.35},
    {pitch:[55,59,62],    time:18.5, dur:1.5, vel:0.3},
    {pitch:[60,64,67],    time:20.5, dur:1.5, vel:0.3},
  ];

  // 铃铛装饰音（高音铃声，圣诞感）
  var bells = [
    {pitch:84, time:0,   dur:0.25, vel:0.5}, // C6
    {pitch:88, time:1,   dur:0.25, vel:0.4}, // E6
    {pitch:91, time:2,   dur:0.25, vel:0.5}, // G6
    {pitch:88, time:3,   dur:0.25, vel:0.4},
    {pitch:84, time:4,   dur:0.25, vel:0.5},
    {pitch:88, time:5,   dur:0.25, vel:0.4},
    {pitch:83, time:6,   dur:0.25, vel:0.5}, // B5
    {pitch:88, time:7,   dur:0.25, vel:0.4},
    {pitch:91, time:8,   dur:0.25, vel:0.5},
    {pitch:93, time:9,   dur:0.25, vel:0.4}, // A6
    {pitch:91, time:10,  dur:0.25, vel:0.5},
    {pitch:88, time:11,  dur:0.25, vel:0.4},
    {pitch:84, time:12,  dur:0.25, vel:0.5},
    {pitch:88, time:13,  dur:0.25, vel:0.4},
    {pitch:83, time:14,  dur:0.25, vel:0.5},
    {pitch:88, time:15,  dur:0.25, vel:0.4},
    {pitch:84, time:16,  dur:0.25, vel:0.5},
    {pitch:88, time:17,  dur:0.25, vel:0.4},
    {pitch:91, time:18,  dur:0.25, vel:0.5},
    {pitch:88, time:19,  dur:0.25, vel:0.4},
    {pitch:84, time:20,  dur:0.5,  vel:0.6},
    {pitch:84, time:21,  dur:0.5,  vel:0.5},
    {pitch:84, time:22,  dur:0.5,  vel:0.4},
    {pitch:84, time:23,  dur:0.5,  vel:0.3},
  ];

  // 轻量打击乐（电子踩镲/沙锤）
  var perc = [];
  for(var bar=0; bar<6; bar++){
    var base = bar * 4;
    // 4/4 拍：1, 1.5, 2, 2.5, 3, 3.5, 4
    perc.push({pitch:0, time:base+0.5, dur:0.1, vel:0.4}); // 切分
    perc.push({pitch:0, time:base+1.5, dur:0.1, vel:0.35});
    perc.push({pitch:0, time:base+2.5, dur:0.1, vel:0.35});
    perc.push({pitch:0, time:base+3.5, dur:0.1, vel:0.3});
  }

  // 总长度（拍） -> 秒
  var TOTAL_BEATS = 24;
  var LOOP_SEC = TOTAL_BEATS * BEAT;

  return {
    TEMPO: TEMPO,
    BEAT: BEAT,
    SWING: SWING,
    LOOP_SEC: LOOP_SEC,
    INST: INST,
    tracks: [
      { id:"melody", inst:"bell",   notes:melody },
      { id:"bass",   inst:"bass",   notes:bass   },
      { id:"chord",  inst:"synth",  notes:chord  },
      { id:"bells",  inst:"chime",  notes:bells  },
      { id:"perc",   inst:"perc",   notes:perc   }
    ]
  };
})();

if(typeof module!=="undefined") module.exports = AudioData;