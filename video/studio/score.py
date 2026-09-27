"""Original 120 BPM instrumental score and synchronized foley. No sampled music."""
import wave
import numpy as np
from pathlib import Path
SR=48000
DURATION=42
rng=np.random.default_rng(4315)
mix=np.zeros((SR*DURATION,2),dtype=np.float64)
def add(start,sound,gain=1,pan=0):
    offset=round(start*SR)
    if offset<0:return
    n=min(len(sound),len(mix)-offset)
    if n<=0:return
    if sound.ndim==1:sound=np.stack([sound*np.sqrt((1-pan)/2),sound*np.sqrt((1+pan)/2)],axis=1)
    mix[offset:offset+n]+=sound[:n]*gain
def hz(m):return 440*2**((m-69)/12)
def pluck(m,duration=1.5):
    t=np.arange(round(SR*duration))/SR
    s=sum(np.sin(2*np.pi*hz(m)*k*t+.13*k)*np.exp(-t*(2.6+k*.7))/k**1.8 for k in range(1,6))
    return s*np.minimum(t/.005,1)*np.minimum((duration-t)/.06,1)
def pad(notes,duration):
    t=np.arange(round(SR*duration))/SR
    s=np.zeros((len(t),2))
    for j,m in enumerate(notes):
        for side in range(2):
            f=hz(m)*(1+(.0017 if side else -.0017))
            s[:,side]+=(np.sin(2*np.pi*f*t+j)+.17*np.sin(2*np.pi*f*2*t))* .14
    env=np.minimum(t/1.2,1)*np.minimum((duration-t)/1.5,1)
    return s*env[:,None]
chords=[[50,57,60,64,69],[46,53,57,60,65],[48,55,60,64,67],[45,52,57,60,64]]
for bar in range(11):
    start=bar*4
    add(start,pad(chords[bar%4],5.8),.28 if start<7 else .43)
for beat in range(80):
    at=beat*.5
    if at<4 or at>=39:continue
    t=np.arange(int(.48*SR))/SR
    kick=np.sin(2*np.pi*(47*t+6*(1-np.exp(-t*32))))*np.exp(-t*12)*np.minimum(t/.003,1)
    add(at,kick,.29 if at>=10 else .17)
    if beat%2:
        t=np.arange(int(.18*SR))/SR
        noise=rng.normal(0,1,len(t));noise=np.concatenate([[0],np.diff(noise)])
        snap=(noise*.2+np.sin(2*np.pi*174*t)*.25)*np.exp(-t*29)*np.minimum(t/.003,1)
        add(at,snap,.17)
    for off in [0,.25]:
        t=np.arange(int(.085*SR))/SR
        noise=rng.normal(0,1,len(t));noise=np.concatenate([[0],np.diff(noise)])
        add(at+off,noise*np.exp(-t*75)*np.minimum(t/.001,1),.017 if off else .010,.4 if beat%2 else -.4)
    root=chords[(beat//8)%4][0]-12
    t=np.arange(int(.44*SR))/SR
    bass=(np.sin(2*np.pi*hz(root)*t)+.15*np.sin(2*np.pi*hz(root)*2*t))*np.minimum(t/.018,1)*np.exp(-t*6)
    add(at,bass,.19)
    if beat%2==0 and at>=7:
        note=chords[(beat//8)%4][[2,4,3,1][(beat//2)%4]]+12
        tone=pluck(note)
        add(at,tone,.085,-.23)
        add(at+.375,tone,.026,.55)
        add(at+.75,tone,.012,-.65)
# Arrival tones and short, restrained UI transients.
for at in [4,7,10,14,18,22,27,31,35]:
    t=np.arange(int(.55*SR))/SR
    noise=rng.normal(0,1,len(t))
    soft=np.convolve(noise,np.ones(21)/21,mode='same')
    env=np.sin(np.pi*np.arange(len(t))/len(t))**3
    add(max(0,at-.48),soft*env,.2,-.2)
    add(at,pluck(74,.8),.038,.2)
for at in [1.1,5.4,13.9,17.9,25.9,28.3]:
    t=np.arange(int(.055*SR))/SR
    add(at,rng.normal(0,1,len(t))*np.exp(-t*130),.035)
for j,n in enumerate([62,69,76,81]):add(35+j*.1,pluck(n,3.5),.085,(j-1.5)*.25)
mix*=np.minimum(np.arange(len(mix))/SR/1.3,1)[:,None]
mix*=np.minimum((DURATION-np.arange(len(mix))/SR)/2.3,1)[:,None]
mix=np.tanh(mix*1.4)
mix*=.87/max(np.max(np.abs(mix)),.01)
Path('out').mkdir(exist_ok=True)
with wave.open('out/score.wav','wb') as f:
    f.setnchannels(2);f.setsampwidth(2);f.setframerate(SR);f.writeframes((mix*32767).astype('<i2').tobytes())
