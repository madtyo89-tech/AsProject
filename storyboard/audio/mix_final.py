import subprocess, json, imageio_ffmpeg, wave, glob, sys
SILENT = sys.argv[1] if len(sys.argv)>1 else 'storyboard/video-silent.mp4'
OUT = sys.argv[2] if len(sys.argv)>2 else 'storyboard/asproject-promo-storyboard-30s.mp4'
TITLE = sys.argv[3] if len(sys.argv)>3 else 'AsProject - Storyboard Promo 30 Detik'
ff=imageio_ffmpeg.get_ffmpeg_exe()
scenes=json.load(open('storyboard/audio/scene-durations.json'))
trims=json.load(open('storyboard/audio/trim/durations.json'))
files=sorted(glob.glob('storyboard/audio/trim/vo-*.wav'))
starts=[]; t=0
for d in scenes: starts.append(t); t+=d
inputs=[]; filters=[]; labels=[]
print("total",t)
for i,(f,d,st) in enumerate(zip(files,scenes,starts)):
    td=trims[f]
    tempo=max(1.0, td/(d-0.55))
    tempo=min(tempo,1.30)
    inputs += ['-i',f]
    delay=int((st+0.18)*1000)
    filters.append(f"[{i}:a]atempo={tempo:.3f},adelay={delay}|{delay},volume=1.15[v{i}]")
    labels.append(f"[v{i}]")
    print(i+1,f"start={st:.1f} scene={d} trim={td:.2f} tempo={tempo:.3f} -> {td/tempo:.2f}")
filters.append("".join(labels)+f"amix=inputs={len(labels)}:duration=longest:normalize=0,atrim=0:30,asetpts=N/SR/TB[vo]")
cmd=[ff,'-y']+inputs+['-filter_complex',';'.join(filters),'-map','[vo]','-ac','1','-ar','44100','storyboard/audio/vo-mix.wav']
subprocess.run(cmd,check=True)
# final mux: VO + music ducked by fixed low volume, loudness normalize
fc=("[2:a]atrim=0:30,asetpts=N/SR/TB,volume=0.14,afade=t=in:st=0:d=0.6,afade=t=out:st=28.2:d=1.8[mus];"
    "[1:a]apad=whole_dur=30,atrim=0:30,volume=1.0[vo];[vo][mus]amix=inputs=2:duration=first:normalize=0,"
    "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.95[aout]")
cmd=[ff,'-y','-i',SILENT,'-i','storyboard/audio/vo-mix.wav','-i','music/backsound-asproject.mp3',
     '-filter_complex',fc,'-map','0:v','-map','[aout]','-c:v','copy','-c:a','aac','-b:a','160k','-ar','44100',
     '-t','30','-movflags','+faststart','-metadata','title='+TITLE, OUT]
subprocess.run(cmd,check=True)
print("done")
