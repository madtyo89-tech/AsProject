import subprocess, glob, os, wave, json
import numpy as np, imageio_ffmpeg
ff=imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs('storyboard/audio/trim',exist_ok=True)
def dur_wav(p):
    with wave.open(p) as w: return w.getnframes()/w.getframerate()
out={}
for p in sorted(glob.glob('storyboard/audio/vo-*.mp3')):
    raw='/tmp/x.wav'
    subprocess.run([ff,'-y','-v','error','-i',p,'-ac','1','-ar','44100',raw],check=True)
    with wave.open(raw) as w:
        sr=w.getframerate(); data=np.frombuffer(w.readframes(w.getnframes()),dtype=np.int16).astype(np.float32)/32768
    # 10ms frames energy
    fl=int(sr*0.01); n=len(data)//fl
    rms=np.sqrt((data[:n*fl].reshape(n,fl)**2).mean(axis=1)+1e-12)
    db=20*np.log10(rms+1e-9)
    silent=db<-40
    keep=np.ones(len(data),bool)
    # compress silent runs > 90ms to 90ms; edges handled same
    i=0
    while i<n:
        if silent[i]:
            j=i
            while j<n and silent[j]: j+=1
            run=j-i; keep_frames=9  # 90ms
            if run>keep_frames:
                # keep first 4 and last 5 frames of run
                rem_start=(i+4)*fl; rem_end=(j-5)*fl
                keep[rem_start:rem_end]=False
            i=j
        else: i+=1
    y=data[keep]
    op='storyboard/audio/trim/'+os.path.basename(p).replace('.mp3','.wav')
    with wave.open(op,'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(y,-1,1)*32767).astype(np.int16).tobytes())
    out[op]=len(y)/sr
    print(op, f"{len(data)/sr:.2f} -> {len(y)/sr:.2f}")
print("trim total",sum(out.values()))
json.dump(out,open('storyboard/audio/trim/durations.json','w'),indent=1)
