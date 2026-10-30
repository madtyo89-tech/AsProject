#!/usr/bin/env python3
"""
Render storyboard animatic AsProject — Reels/TikTok 1080x1920.

Usage:
  python3 storyboard/render_storyboard.py keyframes   # panel PNG per scene
  python3 storyboard/render_storyboard.py video [durasi.json]  # MP4 senyap (storyboard)
  python3 storyboard/render_storyboard.py video-clean [durasi.json] [out.mp4]  # tanpa label SCENE
durasi.json: list durasi per scene (detik). Default: 10 x 3.0 detik.
"""
import json, math, os, random, subprocess, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SB = os.path.join(ROOT, "storyboard")
FDIR = os.path.join(SB, "assets-fonts")
W, H, FPS = 1080, 1920, 30
CLEAN = False  # True = versi upload: tanpa label SCENE & tanpa progress bar

# ---------- fonts ----------
_fc = {}
def font(name, size):
    k = (name, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(os.path.join(FDIR, name), size)
    return _fc[k]
def XB(s): return font("Poppins-ExtraBold.ttf", s)
def BL(s): return font("Poppins-Black.ttf", s)
def BD(s): return font("Poppins-Bold.ttf", s)
def SBd(s): return font("Poppins-SemiBold.ttf", s)
def MD(s): return font("Poppins-Medium.ttf", s)

# ---------- helpers ----------
def hex2rgb(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def ease_out_back(x, s=1.9):
    x=min(max(x,0),1); return 1+(s+1)*((x-1)**3)+s*((x-1)**2)
def ease_out(x): x=min(max(x,0),1); return 1-(1-x)**3
def pop(t, delay, dur=.45):
    return ease_out_back((t-delay)/dur) if t>delay else 0.0

def make_grad(top, bot):
    t,b = np.array(hex2rgb(top),dtype=float), np.array(hex2rgb(bot),dtype=float)
    y = np.linspace(0,1,H)[:,None,None]
    x = np.linspace(0,0.18,W)[None,:,None]
    arr = (t*(1-y-x*0.4)+b*(y+x*0.4)).astype(np.uint8)
    return Image.fromarray(arr,'RGB')

_imgc={}
def load_img(path):
    if path not in _imgc: _imgc[path]=Image.open(os.path.join(ROOT,path)).convert('RGB')
    return _imgc[path]

def fit_crop(img, w, h, zoom=1.0, cy=0.5):
    iw, ih = img.size
    scale = max(w/iw, h/ih)*zoom
    nw, nh = int(iw*scale+1), int(ih*scale+1)
    im = img.resize((nw,nh), Image.LANCZOS)
    x = (nw-w)//2; y = int((nh-h)*cy)
    return im.crop((x,y,x+w,y+h))

def rr(draw, box, r, **kw): draw.rounded_rectangle(box, radius=r, **kw)
def tc(draw, cx, y, text, f, fill, stroke=0, sc=(0,0,0)):
    draw.text((cx,y), text, font=f, fill=fill, anchor="ma",
              stroke_width=stroke, stroke_fill=sc)
def text_w(draw, text, f): return draw.textlength(text, font=f)

def paste_shadow(base, layer, xy, blur=24, alpha=110, off=(0,18)):
    sh = Image.new('RGBA', layer.size, (0,0,0,0))
    m = layer.split()[3]
    solid = Image.new('RGBA', layer.size, (20,8,32,alpha))
    sh.paste(solid,(0,0),m); sh = sh.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(sh,(xy[0]+off[0], xy[1]+off[1]))
    base.alpha_composite(layer, xy)

def sticker(base, text, cx, cy, bg, fg="#FFFFFF", size=44, angle=-6, scale=1.0, pad_x=36):
    if scale<=0.02: return
    f = BD(max(10,int(size*scale)))
    tmp = ImageDraw.Draw(Image.new('RGBA',(10,10)))
    tw = text_w(tmp, text, f); th = int(size*scale*1.55)
    w_,h_ = int(tw+pad_x*2*scale), th
    lay = Image.new('RGBA',(w_+30,h_+30),(0,0,0,0)); d=ImageDraw.Draw(lay)
    rr(d,[15,15,w_+15,h_+15], h_//2, fill=hex2rgb(bg)+(255,))
    rr(d,[15,15,w_+15,h_+15], h_//2, outline=(255,255,255,255), width=max(2,int(5*scale)))
    d.text(((w_+30)/2,(h_+30)/2), text, font=f, fill=hex2rgb(fg), anchor="mm")
    lay = lay.rotate(angle, expand=True, resample=Image.BICUBIC)
    paste_shadow(base, lay, (int(cx-lay.size[0]/2), int(cy-lay.size[1]/2)), blur=10, alpha=90, off=(0,10))

def phone_layer(img_path, w=470, zoom=1.0, cy=0.42):
    h = int(w*844/390) if 'preview' in img_path or 'template' in img_path else int(w*1.94)
    h = min(h, 1020)
    pad=18
    lay = Image.new('RGBA',(w+pad*2,h+pad*2),(0,0,0,0)); d=ImageDraw.Draw(lay)
    rr(d,[2,2,w+pad*2-2,h+pad*2-2], 64, fill=(24,18,38,255))
    rr(d,[2,2,w+pad*2-2,h+pad*2-2], 64, outline=(255,255,255,200), width=4)
    inner = fit_crop(load_img(img_path), w, h, zoom=zoom, cy=cy)
    mask = Image.new('L',(w,h),0); md=ImageDraw.Draw(mask); rr(md,[0,0,w,h],48,fill=255)
    lay.paste(inner,(pad,pad),mask)
    d=ImageDraw.Draw(lay)
    rr(d,[w//2-52+pad, pad+14, w//2+52+pad, pad+40], 13, fill=(24,18,38,235))
    return lay

def confetti(base, seed, gt, n=46, burst=False):
    rnd = random.Random(seed)
    lay = Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(lay)
    cols=[(255,255,255),(255,214,64),(255,255,255),(255,182,213),(165,243,252)]
    for i in range(n):
        x0=rnd.uniform(0,W); y0=rnd.uniform(0,H); sp=rnd.uniform(26,80)
        sz=rnd.uniform(7,17); c=cols[i%len(cols)]+(rnd.randint(90,190),)
        y=(y0+sp*gt)%(H+40)-20; x=x0+math.sin(gt*1.5+i)*14
        if burst:
            a=rnd.uniform(0,2*math.pi); r=(gt*130+i*23)%760
            x=W/2+math.cos(a)*r; y=H*0.42+math.sin(a)*r*1.3
        if i%3==0: d.ellipse([x-sz,y-sz,x+sz,y+sz],fill=c)
        elif i%3==1: d.rectangle([x-sz,y-sz*0.5,x+sz,y+sz*0.5],fill=c)
        else: d.polygon([(x,y-sz),(x+sz,y+sz),(x-sz,y+sz)],fill=c)
    base.alpha_composite(lay)

# ---------- scene data ----------
YEL="#FFD640"; WHI="#FFFFFF"
SCENES=[
 dict(bg=("#FF5D8F","#FF8A5C"), kick="STOP SCROLL DULU!",
      head=[("Masih Cetak",WHI,96),("Undangan Kertas?",YEL,92)],
      sub="Zaman sekarang kok masih antar-antar?",
      cap="Masih cetak undangan kertas? Ribet banget!",
      vo="Masih cetak undangan kertas? Ribet banget!",
      kind="phone", img="assets/demo/ice-blue/06-undangan.jpg",
      stickers=[("MAHAL","#E11D48",180,860,-9,.55),("RIBET","#7C3AED",905,1010,7,.85),("LAMA BANGET","#0EA5E9",215,1280,6,1.15)], badge="X"),
 dict(bg=("#7C3AED","#EC4899"), kick="KENALIN NIH...",
      head=[("AsProject",YEL,118),("Undangan Digital Online",WHI,62)],
      sub="Studio undangan online dari Bandung",
      cap="Kenalin AsProject! Undangan digital online!",
      vo="Kenalin AsProject! Undangan digital online!",
      kind="phone", img="assets/demo/wedding/03-luxury-gold.jpg",
      stickers=[("ONLINE","#06B6D4",175,900,-8,.6),("PRAKTIS!","#F59E0B",900,1210,8,.95)]),
 dict(bg=("#06B6D4","#3B82F6"), kick="BUAT SEMUA ACARA",
      head=[("34 Tema Cantik",WHI,96),("Siap Pakai!",YEL,96)],
      sub="Tinggal pilih yang paling kamu banget",
      cap="Tiga puluh empat tema cantik siap pakai!",
      vo="Tiga puluh empat tema cantik siap pakai!", kind="grid"),
 dict(bg=("#10B981","#06B6D4"), kick="SEMUDAH INI LOH",
      head=[("Isi Nama, Tanggal",WHI,88),("& Foto. Jadi Deh!",YEL,88)],
      sub="Tanpa ribet, tanpa nunggu percetakan",
      cap="Isi nama, tanggal, foto. Langsung jadi!",
      vo="Isi nama, tanggal, foto. Langsung jadi!",
      kind="phone", img="assets/demo/ice-blue/02-foto-studio.jpg",
      stickers=[("Rangga & Alya","#111827",235,830,-5,.55),("28 Des 2026","#111827",885,1045,6,.9),("FOTO: OK","#16A34A",240,1300,5,1.2)]),
 dict(bg=("#8B5CF6","#D946EF"), kick="FITURNYA SERU-SERU!",
      head=[("Countdown, Galeri,",WHI,82),("Musik & Lainnya!",YEL,86)],
      sub="Undangan hidup, bukan gambar diam",
      cap="Ada countdown, galeri, dan musik!",
      vo="Ada countdown, galeri, dan musik!",
      kind="phone", img=".preview-shots/31-undangan-live-template-kustom.png",
      stickers=[("COUNTDOWN","#EE4444",200,850,-7,.55),("GALERI FOTO","#0EA5E9",890,1020,7,.9),("MUSIK","#F59E0B",205,1275,6,1.25)]),
 dict(bg=("#F43F5E","#FB923C"), kick="MOMEN TAMU BUKA...",
      head=[("Tamu Buka...",WHI,96),("Langsung WOW!",YEL,102)],
      sub="Amplopnya bisa dibuka beneran!",
      cap="Tamu buka undangan, langsung wow!",
      vo="Tamu buka undangan, langsung wow!",
      kind="phone", img=".preview-shots/33-cover-batik-nusantara.png",
      stickers=[("KETUK!","#7C3AED",875,840,-8,.7)], pulse=True),
 dict(bg=("#2563EB","#7C3AED"), kick="TAMU MAKIN GAMPANG",
      head=[("Amplop + RSVP",WHI,92),("+ Peta Lokasi",YEL,92)],
      sub="Semua kebutuhan tamu dalam satu link",
      cap="Amplop digital, RSVP, plus peta lokasi!",
      vo="Amplop digital, RSVP, plus peta lokasi!", kind="features"),
 dict(bg=("#16A34A","#0D9488"), kick="SEBARINNYA GAMPANG",
      head=[("Publish! Sebar",WHI,94),("Satu Link Saja",YEL,94)],
      sub="Kirim ke semua tamu dalam sekejap",
      cap="Publish! Sebar satu link lewat WhatsApp!",
      vo="Publish! Sebar satu link lewat WhatsApp!",
      kind="phone", img="assets/demo/ice-blue/03-lamaran.jpg",
      stickers=[("SEBAR VIA WA","#111827",880,1080,7,.8)], link=True),
 dict(bg=("#F59E0B","#F97316"), kick="HARGANYA? SANTAI...",
      head=[("Nggak Pakai",WHI,92),("Mahal-Mahal!", "#7C2D12",94)],
      sub="Jauh lebih hemat dari cetak kertas",
      cap="Mulai empat puluh sembilan ribu per tema!",
      vo="Mulai empat puluh sembilan ribu per tema!", kind="price"),
 dict(bg=("#17112E","#3B1D5E"), kick="GILIRAN KAMU NIH",
      head=[("Yuk, Buat",WHI,104),("Sekarang!",YEL,112)],
      sub="",
      cap="Yuk buat sekarang di asproject.my.id!",
      vo="Yuk buat sekarang di AsProject dot my dot id!", kind="cta"),
]

GRID=[("PERNIKAHAN","assets/demo/wedding/01-jawa-elegan.jpg"),
      ("KHITANAN","assets/demo/khitanan/02-biru-ceria.jpg"),
      ("ULANG TAHUN","assets/demo/ultah/01-kids-party.jpg"),
      ("AQIQAH","assets/demo/aqiqah/01-baby-boy.jpg")]
FEATS=[("AMPLOP DIGITAL","Kirim salam tempel online","#F59E0B","env"),
       ("RSVP ONLINE","Tamu konfirmasi kehadiran","#22C55E","check"),
       ("PETA LOKASI","Nggak ada tamu nyasar lagi","#38BDF8","pin")]

_grads={}
def base_for(i):
    if i not in _grads: _grads[i]=make_grad(*SCENES[i]['bg'])
    return _grads[i].copy().convert('RGBA')

def draw_icon(d, kind, cx, cy, s, col):
    c=hex2rgb(col)
    if kind=="env":
        rr(d,[cx-s,cy-s*.65,cx+s,cy+s*.65],16,fill=c)
        d.polygon([(cx-s,cy-s*.6),(cx+s,cy-s*.6),(cx,cy+s*.25)],fill=(255,255,255))
    elif kind=="check":
        d.ellipse([cx-s,cy-s,cx+s,cy+s],fill=c)
        d.line([(cx-s*.55,cy),(cx-s*.12,cy+s*.45),(cx+s*.6,cy-s*.45)],fill=(255,255,255),width=16,joint="curve")
    else:
        d.ellipse([cx-s*.8,cy-s,cx+s*.8,cy+s*.55],fill=c)
        d.polygon([(cx-s*.55,cy+s*.25),(cx+s*.55,cy+s*.25),(cx,cy+s*1.15)],fill=c)
        d.ellipse([cx-16,cy-38,cx+16,cy-6],fill=(255,255,255))

def render(idx, lt, dur, gt):
    s=SCENES[idx]; img=base_for(idx); confetti(img, idx*7+3, gt, burst=(s['kind']=="cta"))
    d=ImageDraw.Draw(img)
    # top bar (label SCENE hanya untuk versi storyboard)
    if not CLEAN:
        tag=f"SCENE {idx+1:02d} / 10"
        rr(d,[48,52,48+text_w(d,tag,BD(34))+56,118],33,fill=(15,10,35,150))
        d.text((76,85),tag,font=BD(34),fill=(255,255,255),anchor="lm")
    tc(d,W-190,62,"AsProject",BD(38),(255,255,255,235))
    # kicker
    ks=pop(lt,0.0,.35)
    if ks>0:
        lay=Image.new('RGBA',(W,120),(0,0,0,0)); ld=ImageDraw.Draw(lay)
        kw=text_w(ld,s['kick'],BD(int(40*ks)))+72*ks
        rr(ld,[(W-kw)/2,10,(W+kw)/2,10+66*ks],33,fill=(255,255,255,255))
        ld.text((W/2,10+33*ks),s['kick'],font=BD(max(8,int(40*ks))),fill=(40,20,70),anchor="mm")
        img.alpha_composite(lay,(0,158)); d=ImageDraw.Draw(img)
    # headline
    hp=ease_out(lt/.5); y=268-int((1-hp)*40)
    for txt,col,sz in s['head']:
        f=XB(int(sz*hp)) if hp>0.05 else XB(8)
        tc(d,W/2+4,y+6,txt,f,(30,10,50))
        tc(d,W/2,y,txt,f,hex2rgb(col))
        y+=int(sz*1.12)
    if s.get('sub'):
        tc(d,W/2,y+4,s['sub'],MD(40),(255,255,255,235))
    kind=s['kind']
    vy_end=1470
    if kind=="phone":
        bob=int(math.sin(gt*2.2)*10); ent=ease_out(lt/.6)
        zoom=1.0+0.07*min(lt/dur,1)
        pl=phone_layer(s['img'],470,zoom=zoom)
        px=(W-pl.size[0])//2; py=int(590+(1-ent)*160)+bob
        paste_shadow(img,pl,(px,py)); d=ImageDraw.Draw(img)
        if s.get('badge')=='X':
            bs=pop(lt,.5,.4); bx,by=px+pl.size[0]-40,py+80; r=int(78*bs)
            if r>4:
                d.ellipse([bx-r,by-r,bx+r,by+r],fill=(225,29,72),outline=(255,255,255),width=9)
                tc(d,bx,by-int(66*bs),"X",BL(max(8,int(96*bs))),(255,255,255))
        if s.get('pulse'):
            pr=60+int(28*(0.5+0.5*math.sin(gt*5)))
            cx,cy=W//2,py+int(pl.size[1]*0.78)
            d.ellipse([cx-pr,cy-pr,cx+pr,cy+pr],outline=(255,255,255,220),width=8)
        if s.get('link'):
            ls=pop(lt,.55,.4)
            if ls>0.05:
                txt="asproject.my.id/u/rangga-Alya"; f=BD(max(8,int(40*ls)))
                tw=text_w(d,txt,f)+80*ls; lx,ly=(W-tw)/2,py+pl.size[1]-int(70*ls)
                rr(d,[lx,ly,lx+tw,ly+92*ls],46,fill=(17,24,39,245),outline=(255,214,64),width=5)
                tc(d,W/2,ly+92*ls/2-int(40*ls*0.72),txt,f,(255,214,64))
        for txt,col,cx,cy,ang,delay in s.get('stickers',[]):
            sticker(img,txt,cx,cy+bob//2,col,angle=ang,scale=pop(lt,delay,.4))
        d=ImageDraw.Draw(img)
    elif kind=="grid":
        cw,ch,gap=432,452,28; x0=(W-2*cw-gap)//2; y0=620
        for k,(lab,path) in enumerate(GRID):
            ps=pop(lt,.25+k*.28,.45)
            if ps<=0.05: continue
            cx=x0+(k%2)*(cw+gap); cy=y0+(k//2)*(ch+gap)
            w_,h_=int(cw*ps),int(ch*ps); ox,oy=cx+(cw-w_)//2,cy+(ch-h_)//2
            im=fit_crop(load_img(path),w_,max(10,h_-64),cy=0.35)
            mask=Image.new('L',(w_,h_),0); md=ImageDraw.Draw(mask); rr(md,[0,0,w_,h_],36,fill=255)
            card=Image.new('RGBA',(w_,h_),(255,255,255,255)); card.paste(im,(0,0))
            cd=ImageDraw.Draw(card); tc(cd,w_/2,h_-58,lab,BD(max(8,int(36*ps))),(30,25,60))
            img.paste(card,(ox,oy),mask); d=ImageDraw.Draw(img)
    elif kind=="features":
        y0=650
        for k,(t1,t2,col,ic) in enumerate(FEATS):
            ps=ease_out((lt-.25-k*.3)/.45)
            if ps<=0: continue
            cw,ch=int(880*ps),220; x=(W-cw)//2; yy=y0+k*252
            rr(d,[x,yy,x+cw,yy+ch],44,fill=(255,255,255,245))
            draw_icon(d,ic,x+118,yy+110,52,col)
            d.text((x+205,yy+44),t1,font=BD(50),fill=(28,22,58))
            d.text((x+207,yy+116),t2,font=MD(37),fill=(90,85,120))
    elif kind=="price":
        ps=pop(lt,.3,.5); cw,ch=int(880*ps),int(700*ps)
        if cw>40:
            x,y=(W-cw)//2,660+(700-ch)//2
            rr(d,[x,y,x+cw,y+ch],56,fill=(255,255,255,255),outline=(124,45,18),width=6)
            tc(d,W/2,y+48*ps,"MULAI DARI",BD(max(8,int(42*ps))),(180,83,9))
            tc(d,W/2,y+118*ps,"Rp49.000",BL(max(8,int(128*ps))),(28,22,58))
            tc(d,W/2,y+282*ps,"per tema undangan",MD(max(8,int(46*ps))),(90,85,120))
            bl="COBA DEMO GRATIS DULU!"; bf=BD(max(8,int(44*ps)))
            bw=text_w(d,bl,bf)+90*ps
            rr(d,[(W-bw)/2,y+392*ps,(W+bw)/2,y+392*ps+104*ps],52,fill=(22,163,74))
            tc(d,W/2,y+392*ps+104*ps/2-30*ps,bl,bf,(255,255,255))
            tc(d,W/2,y+ch-70*ps,"*Ketentuan dikonfirmasi sebelum membayar",MD(max(8,int(30*ps))),(120,113,108))
    elif kind=="cta":
        # logo
        ps=pop(lt,.25,.5)
        if ps>0.05:
            logo=Image.open(os.path.join(ROOT,"assets/ikon-512.png")).convert('RGBA')
            sz=int(330*ps); logo=logo.resize((sz,sz),Image.LANCZOS)
            m=Image.new('L',(sz,sz),0); ImageDraw.Draw(m).ellipse([0,0,sz,sz],fill=255)
            img.paste(logo,((W-sz)//2,640),m); d=ImageDraw.Draw(img)
            d.ellipse([(W-sz)//2-6,634,(W+sz)//2+6,646+sz],outline=(212,175,55),width=6)
        tc(d,W/2,1010,"asproject.my.id",XB(76),(246,231,178))
        tc(d,W/2,1112,"Cepat  -  Cantik  -  Praktis",SBd(44),(255,255,255,220))
        pul=1+0.04*math.sin(gt*4)
        bl="BUAT UNDANGANKU"; bf=XB(int(52*pul)); bw=text_w(d,bl,bf)+130
        rr(d,[(W-bw)/2,1218,(W+bw)/2,1350],66,fill=hex2rgb(YEL))
        tc(d,W/2,1252,bl,bf,(45,25,70))
    # caption bar
    cap=s['cap']; f=SBd(43)
    words=cap.split(); lines=[]; cur=""
    for wd in words:
        if text_w(d,cur+" "+wd,f)<880: cur=(cur+" "+wd).strip()
        else: lines.append(cur); cur=wd
    if cur: lines.append(cur)
    bh=64+58*len(lines); by=1665-bh+80
    rr(d,[56,by,W-56,by+bh],36,fill=(14,10,34,190))
    for k,ln in enumerate(lines): tc(d,W/2,by+20+k*58,ln,f,(255,255,255))
    # progress (hanya versi storyboard; platform punya progress sendiri)
    if not CLEAN:
        total_progress=(idx+min(lt/dur,1))/len(SCENES)
        d.rectangle([0,H-16,W,H],fill=(15,10,35,160))
        d.rectangle([0,H-16,int(W*total_progress),H],fill=hex2rgb(YEL))
    return img.convert('RGB')

def keyframes():
    out=os.path.join(SB,"frames"); os.makedirs(out,exist_ok=True)
    for i in range(len(SCENES)):
        im=render(i,2.0,3.0,i*3+2.0)
        im.save(os.path.join(out,f"scene-{i+1:02d}.png"))
        im.resize((540,960),Image.LANCZOS).save(os.path.join(out,f"scene-{i+1:02d}.jpg"),quality=88)
        print("scene",i+1,"ok")
    # contact sheet 5x2
    sheet=Image.new('RGB',(540*5,960*2),(20,16,40))
    for i in range(len(SCENES)):
        im=Image.open(os.path.join(out,f"scene-{i+1:02d}.jpg"))
        sheet.paste(im,((i%5)*540,(i//5)*960))
    sheet.save(os.path.join(SB,"storyboard-contact-sheet.jpg"),quality=90)
    print("contact sheet ok")

def video(durations, outpath):
    import imageio_ffmpeg
    ff=imageio_ffmpeg.get_ffmpeg_exe()
    cmd=[ff,"-y","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),
         "-i","-","-an","-c:v","libx264","-pix_fmt","yuv420p","-crf","19","-preset","medium",
         "-movflags","+faststart",outpath]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.DEVNULL)
    gt=0.0
    for i,dur in enumerate(durations):
        n=int(round(dur*FPS))
        for fr in range(n):
            lt=fr/FPS
            frame=render(i,lt,dur,gt+lt)
            proc.stdin.write(np.asarray(frame).tobytes())
        gt+=dur; print(f"scene {i+1} done ({dur:.2f}s) total {gt:.1f}s",flush=True)
    proc.stdin.close(); proc.wait()
    print("saved",outpath)

if __name__=="__main__":
    mode=sys.argv[1] if len(sys.argv)>1 else "keyframes"
    if mode=="keyframes": keyframes()
    elif mode=="vo":
        for i,s in enumerate(SCENES): print(f"{i+1:02d}|{s['vo']}")
    elif mode in ("video","video-clean"):
        if mode=="video-clean": CLEAN=True
        durs=[3.0]*10; out=os.path.join(SB,"video-silent.mp4")
        if len(sys.argv)>2:
            durs=json.load(open(sys.argv[2]))
        if len(sys.argv)>3: out=sys.argv[3]
        video(durs,out)
