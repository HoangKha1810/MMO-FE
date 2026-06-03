'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Cpu,
  Gamepad2,
  HardDrive,
  ImageIcon,
  Monitor,
  PackageCheck,
  Play,
  Sparkles,
  Terminal,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageHero, SectionHeader, SectionPanel } from '@/components/ui/page-layout';
import { cn } from '@/lib/utils';

type ImageTheme = 'render' | 'ai' | 'game' | 'desktop' | 'custom';
type DesktopMode = 'novnc' | 'rdp' | 'both';
type BaseImage = 'cuda-ubuntu-2204' | 'cuda-ubuntu-2004' | 'pytorch-cuda';

type ToolKey =
  | 'blender'
  | 'comfyui'
  | 'stable-diffusion-webui'
  | 'pytorch'
  | 'jupyter'
  | 'steam-headless'
  | 'obs'
  | 'ffmpeg'
  | 'vscode-server'
  | 'google-chrome';

const VPS_GPU_IMAGE_PRESET_STORAGE_KEY = 'vps_gpu_custom_image_preset_v1';

const themeOptions: Array<{
  value: ImageTheme;
  title: string;
  description: string;
  icon: ReactNode;
  tools: ToolKey[];
  desktopMode: DesktopMode;
}> = [
  {
    value: 'render',
    title: 'Render / Blender',
    description: 'Desktop GUI, Blender, FFmpeg, noVNC để mở Blender bằng trình duyệt và render bằng GPU.',
    icon: <Video className="h-5 w-5" />,
    tools: ['blender', 'ffmpeg', 'vscode-server'],
    desktopMode: 'novnc',
  },
  {
    value: 'ai',
    title: 'AI / ML',
    description: 'PyTorch, Jupyter, ComfyUI hoặc Stable Diffusion WebUI cho workflow AI.',
    icon: <Bot className="h-5 w-5" />,
    tools: ['pytorch', 'jupyter', 'comfyui', 'stable-diffusion-webui'],
    desktopMode: 'novnc',
  },
  {
    value: 'game',
    title: 'Game / Cloud Play',
    description: 'Desktop GUI, Steam headless, OBS và Chrome cho cloud game thử nghiệm.',
    icon: <Gamepad2 className="h-5 w-5" />,
    tools: ['steam-headless', 'obs', 'google-chrome'],
    desktopMode: 'both',
  },
  {
    value: 'desktop',
    title: 'Desktop GUI',
    description: 'Ubuntu Desktop nhẹ với XFCE, noVNC/RDP, SSH server, Chrome và VS Code server.',
    icon: <Monitor className="h-5 w-5" />,
    tools: ['google-chrome', 'vscode-server'],
    desktopMode: 'both',
  },
  {
    value: 'custom',
    title: 'Tự chọn',
    description: 'Chọn tool thủ công và tự đặt tên image theo registry của bạn.',
    icon: <Sparkles className="h-5 w-5" />,
    tools: ['ffmpeg'],
    desktopMode: 'novnc',
  },
];

const toolOptions: Array<{
  value: ToolKey;
  title: string;
  description: string;
  installLines: string[];
  notes?: string;
}> = [
  {
    value: 'blender',
    title: 'Blender',
    description: 'Phần mềm render 3D. Vào Preferences > System để bật CUDA/OptiX.',
    installLines: ['blender'],
  },
  {
    value: 'ffmpeg',
    title: 'FFmpeg',
    description: 'Encode video, xử lý output render.',
    installLines: ['ffmpeg'],
  },
  {
    value: 'pytorch',
    title: 'PyTorch CUDA',
    description: 'Runtime Python/PyTorch dùng GPU.',
    installLines: [],
    notes: 'Nếu chọn base PyTorch thì đã có sẵn PyTorch CUDA.',
  },
  {
    value: 'jupyter',
    title: 'Jupyter Lab',
    description: 'Notebook chạy qua web port 8888.',
    installLines: ['python3-pip'],
  },
  {
    value: 'comfyui',
    title: 'ComfyUI',
    description: 'Node UI cho Stable Diffusion.',
    installLines: ['git', 'python3-pip'],
  },
  {
    value: 'stable-diffusion-webui',
    title: 'SD WebUI',
    description: 'Automatic1111 Stable Diffusion WebUI.',
    installLines: ['git', 'python3-pip'],
  },
  {
    value: 'steam-headless',
    title: 'Steam Headless',
    description: 'Cloud gaming thử nghiệm, nên dùng image chuyên dụng nếu cần ổn định.',
    installLines: ['curl', 'ca-certificates'],
    notes: 'Steam/headless game cần image riêng phức tạp hơn, preset này chỉ tạo nền desktop.',
  },
  {
    value: 'obs',
    title: 'OBS Studio',
    description: 'Ghi hình/stream desktop.',
    installLines: ['obs-studio'],
  },
  {
    value: 'vscode-server',
    title: 'VS Code server',
    description: 'Dùng code-server qua web.',
    installLines: ['curl'],
  },
  {
    value: 'google-chrome',
    title: 'Chrome',
    description: 'Trình duyệt trong desktop GUI.',
    installLines: ['wget', 'gnupg'],
  },
];

const baseImageOptions: Array<{ value: BaseImage; title: string; image: string; description: string }> = [
  {
    value: 'cuda-ubuntu-2204',
    title: 'Ubuntu 22.04 + CUDA 12.4',
    image: 'nvidia/cuda:12.4.1-runtime-ubuntu22.04',
    description: 'Khuyến nghị cho Blender/render/desktop GPU.',
  },
  {
    value: 'cuda-ubuntu-2004',
    title: 'Ubuntu 20.04 + CUDA 12.4',
    image: 'nvidia/cuda:12.4.1-runtime-ubuntu20.04',
    description: 'Dành cho tool cũ cần Ubuntu 20.04.',
  },
  {
    value: 'pytorch-cuda',
    title: 'PyTorch CUDA Runtime',
    image: 'pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime',
    description: 'Khuyến nghị cho AI/ML.',
  },
];

function slugifyImageName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function buildDockerfile(input: {
  baseImage: string;
  desktopMode: DesktopMode;
  selectedTools: ToolKey[];
  exposeSsh: boolean;
  exposeNoVnc: boolean;
  exposeRdp: boolean;
  startCommand: string;
}) {
  const selectedToolMetas = toolOptions.filter((tool) => input.selectedTools.includes(tool.value));
  const aptPackages = unique([
    'bash',
    'ca-certificates',
    'curl',
    'dbus-x11',
    'git',
    'locales',
    'net-tools',
    'openssh-server',
    'sudo',
    'supervisor',
    'wget',
    'xauth',
    'xfce4',
    'xfce4-goodies',
    input.exposeNoVnc ? 'tigervnc-standalone-server' : '',
    input.exposeNoVnc ? 'tigervnc-common' : '',
    input.exposeNoVnc ? 'novnc' : '',
    input.exposeNoVnc ? 'websockify' : '',
    input.exposeRdp ? 'xrdp' : '',
    ...selectedToolMetas.flatMap((tool) => tool.installLines),
  ].filter(Boolean));

  const extraSteps: string[] = [];

  if (input.selectedTools.includes('jupyter')) {
    extraSteps.push('RUN python3 -m pip install --no-cache-dir --upgrade pip jupyterlab');
  }

  if (input.selectedTools.includes('comfyui')) {
    extraSteps.push(
      'RUN git clone --depth=1 https://github.com/comfyanonymous/ComfyUI.git /opt/ComfyUI && python3 -m pip install --no-cache-dir -r /opt/ComfyUI/requirements.txt || true'
    );
  }

  if (input.selectedTools.includes('stable-diffusion-webui')) {
    extraSteps.push('RUN git clone --depth=1 https://github.com/AUTOMATIC1111/stable-diffusion-webui.git /opt/stable-diffusion-webui || true');
  }

  if (input.selectedTools.includes('vscode-server')) {
    extraSteps.push(
      'RUN curl -fsSL https://code-server.dev/install.sh | sh || true'
    );
  }

  if (input.selectedTools.includes('google-chrome')) {
    extraSteps.push(
      'RUN wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && apt-get update && apt-get install -y /tmp/chrome.deb || true && rm -f /tmp/chrome.deb'
    );
  }

  const exposedPorts = unique([
    input.exposeSsh ? '22' : '',
    input.exposeNoVnc ? '6901' : '',
    input.exposeNoVnc ? '5901' : '',
    input.exposeRdp ? '3389' : '',
    input.selectedTools.includes('jupyter') ? '8888' : '',
    input.selectedTools.includes('comfyui') ? '8188' : '',
    input.selectedTools.includes('stable-diffusion-webui') ? '7860' : '',
    input.selectedTools.includes('vscode-server') ? '8080' : '',
  ].filter(Boolean));

  const startScript = `#!/usr/bin/env bash
set -e
mkdir -p /var/run/sshd /root/.vnc
echo "root:\${ROOT_PASSWORD:-trungtammmo}" | chpasswd || true
if [ -n "$PUBLIC_KEY" ]; then
  mkdir -p /root/.ssh
  echo "$PUBLIC_KEY" > /root/.ssh/authorized_keys
  chmod 700 /root/.ssh
  chmod 600 /root/.ssh/authorized_keys
fi
/usr/sbin/sshd || true
${input.exposeRdp ? 'service xrdp start || true' : ''}
${input.exposeNoVnc ? 'vncserver :1 -geometry \\${VNC_RESOLUTION:-1920x1080} -depth 24 || true\nwebsockify --web=/usr/share/novnc/ 6901 localhost:5901 &' : ''}
${input.selectedTools.includes('jupyter') ? 'jupyter lab --ip=0.0.0.0 --port=8888 --allow-root --NotebookApp.token=\\${JUPYTER_TOKEN:-trungtammmo} &' : ''}
${input.selectedTools.includes('comfyui') ? 'cd /opt/ComfyUI && python3 main.py --listen 0.0.0.0 --port 8188 &' : ''}
${input.selectedTools.includes('stable-diffusion-webui') ? 'cd /opt/stable-diffusion-webui && ./webui.sh --listen --port 7860 --enable-insecure-extension-access --skip-torch-cuda-test &' : ''}
${input.selectedTools.includes('vscode-server') ? 'code-server --bind-addr 0.0.0.0:8080 --auth none /workspace &' : ''}
${input.startCommand || 'nvidia-smi || true'}
tail -f /dev/null
`;

  return `FROM ${input.baseImage}

ENV DEBIAN_FRONTEND=noninteractive \\
    TZ=Asia/Ho_Chi_Minh \\
    LANG=C.UTF-8 \\
    LC_ALL=C.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \\
    ${aptPackages.join(' \\\n    ')} \\
  && apt-get clean \\
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /workspace /root/.vnc /var/run/sshd \\
  && locale-gen C.UTF-8 || true

${extraSteps.join('\n\n')}

RUN printf '%s\\n' '${startScript.replace(/'/g, "'\\''")}' > /usr/local/bin/start-vps-gpu.sh \\
  && chmod +x /usr/local/bin/start-vps-gpu.sh

WORKDIR /workspace
${exposedPorts.length ? `EXPOSE ${exposedPorts.join(' ')}` : ''}

CMD ["/usr/local/bin/start-vps-gpu.sh"]
`;
}

function buildStartCommand(selectedTools: ToolKey[]) {
  if (selectedTools.includes('blender')) return 'blender --version && nvidia-smi';
  if (selectedTools.includes('jupyter')) return 'nvidia-smi';
  return 'nvidia-smi';
}

export function VpsGpuImageBuilderPage() {
  const [theme, setTheme] = useState<ImageTheme>('render');
  const [baseImage, setBaseImage] = useState<BaseImage>('cuda-ubuntu-2204');
  const [desktopMode, setDesktopMode] = useState<DesktopMode>('novnc');
  const [selectedTools, setSelectedTools] = useState<ToolKey[]>(['blender', 'ffmpeg', 'vscode-server']);
  const [imageName, setImageName] = useState('your-dockerhub-user/blender-desktop-cuda:latest');
  const [exposeSsh, setExposeSsh] = useState(true);
  const [exposeNoVnc, setExposeNoVnc] = useState(true);
  const [exposeRdp, setExposeRdp] = useState(false);

  const selectedBaseImage = baseImageOptions.find((option) => option.value === baseImage) || baseImageOptions[0];
  const startCommand = useMemo(() => buildStartCommand(selectedTools), [selectedTools]);
  const normalizedImageName = slugifyImageName(imageName);
  const dockerfile = useMemo(
    () =>
      buildDockerfile({
        baseImage: selectedBaseImage.image,
        desktopMode,
        selectedTools,
        exposeSsh,
        exposeNoVnc,
        exposeRdp,
        startCommand,
      }),
    [desktopMode, exposeNoVnc, exposeRdp, exposeSsh, selectedBaseImage.image, selectedTools, startCommand]
  );
  const buildCommands = `mkdir -p vps-gpu-image
cd vps-gpu-image
# Dán nội dung Dockerfile phía dưới vào file Dockerfile
docker build -t ${normalizedImageName || 'your-dockerhub-user/blender-desktop-cuda:latest'} .
docker login
docker push ${normalizedImageName || 'your-dockerhub-user/blender-desktop-cuda:latest'}`;

  function applyTheme(nextTheme: ImageTheme) {
    const preset = themeOptions.find((option) => option.value === nextTheme) || themeOptions[0];
    setTheme(nextTheme);
    setSelectedTools(preset.tools);
    setDesktopMode(preset.desktopMode);
    setExposeNoVnc(preset.desktopMode === 'novnc' || preset.desktopMode === 'both');
    setExposeRdp(preset.desktopMode === 'rdp' || preset.desktopMode === 'both');
    setBaseImage(nextTheme === 'ai' ? 'pytorch-cuda' : 'cuda-ubuntu-2204');
    if (nextTheme === 'render') setImageName('your-dockerhub-user/blender-desktop-cuda:latest');
    if (nextTheme === 'ai') setImageName('your-dockerhub-user/ai-desktop-cuda:latest');
    if (nextTheme === 'game') setImageName('your-dockerhub-user/game-desktop-cuda:latest');
    if (nextTheme === 'desktop') setImageName('your-dockerhub-user/ubuntu-desktop-gpu:latest');
  }

  function toggleTool(tool: ToolKey) {
    setSelectedTools((current) => (current.includes(tool) ? current.filter((item) => item !== tool) : [...current, tool]));
  }

  async function copyText(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(message);
    } catch {
      toast.error('Không thể copy tự động, hãy copy thủ công.');
    }
  }

  function savePreset() {
    if (!normalizedImageName || !normalizedImageName.includes('/')) {
      toast.error('Tên image phải có dạng user/image:tag, ví dụ hkha/blender-desktop-cuda:latest');
      return;
    }

    window.localStorage.setItem(
      VPS_GPU_IMAGE_PRESET_STORAGE_KEY,
      JSON.stringify({
        dockerImage: normalizedImageName,
        onStartCommand: startCommand,
        runtime: 'ssh',
        envFlags: '',
        desktopMode,
        selectedTools,
      })
    );
    toast.success('Đã lưu image preset. Quay lại trang VPS GPU để dùng image này.');
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHero
        eyebrow="Image Builder"
        title="Tạo image riêng cho VPS GPU"
        description="Chọn chủ đề như render, AI, game hoặc Desktop GUI để sinh Dockerfile. Sau khi build và push image lên Docker Hub/GHCR, user có thể dùng image đó trước khi tạo VPS."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/user/vps-gpu">
                <Cpu className="mr-2 h-4 w-4" />
                Về trang VPS GPU
              </Link>
            </Button>
            <Button type="button" onClick={savePreset}>
              <PackageCheck className="mr-2 h-4 w-4" />
              Dùng image này
            </Button>
          </>
        }
        stats={[
          { label: 'Chủ đề', value: String(themeOptions.length), hint: 'Render, AI, game, desktop', tone: 'blue' },
          { label: 'Desktop', value: desktopMode.toUpperCase(), hint: 'noVNC/RDP tùy chọn', tone: 'emerald' },
          { label: 'Tool', value: String(selectedTools.length), hint: 'Gói sẽ cài trong image', tone: 'violet' },
          { label: 'Runtime', value: 'SSH', hint: 'Khuyến nghị cho VPS GPU', tone: 'amber' },
        ]}
      />

      <SectionPanel>
        <SectionHeader
          eyebrow="Bước 1"
          title="Chọn chủ đề image"
          description="Preset chỉ sinh Dockerfile và cấu hình gợi ý. Image chỉ dùng được trên Vast sau khi anh build rồi push lên registry."
        />
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {themeOptions.map((option) => {
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => applyTheme(option.value)}
                className={cn(
                  'interactive-lift min-h-[180px] rounded-[1.1rem] border p-4 text-left transition',
                  active
                    ? 'border-brand-blue bg-brand-blue/10 shadow-[0_22px_70px_-38px_rgba(37,99,235,0.75)]'
                    : 'border-slate-200/70 bg-white/70 hover:border-brand-blue/30 dark:border-white/10 dark:bg-white/[0.035]'
                )}
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
                  {option.icon}
                </span>
                <div className="mt-4 text-base font-black uppercase text-slate-950 dark:text-white">{option.title}</div>
                <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{option.description}</p>
              </button>
            );
          })}
        </div>
      </SectionPanel>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <SectionPanel>
          <SectionHeader eyebrow="Bước 2" title="Cấu hình image" description="Điền tên image registry và chọn các phần mềm cần cài." />
          <div className="mt-5 grid gap-4">
            <Field label="Tên image sau khi push">
              <Input value={imageName} onChange={(event) => setImageName(event.target.value)} placeholder="dockerhub-user/blender-desktop-cuda:latest" />
              <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">
                Đây là giá trị sẽ dán vào ô Image Docker khi tạo VPS, ví dụ <span className="font-mono">hkha/blender-desktop-cuda:latest</span>.
              </p>
            </Field>

            <Field label="Base image">
              <select
                value={baseImage}
                onChange={(event) => setBaseImage(event.target.value as BaseImage)}
                className="field-elevated h-11 w-full rounded-[1rem] px-4 text-sm font-semibold dark:text-white"
              >
                {baseImageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.title}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{selectedBaseImage.description}</p>
            </Field>

            <Field label="Kiểu desktop">
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { value: 'novnc', title: 'noVNC', hint: 'Mở desktop bằng trình duyệt' },
                  { value: 'rdp', title: 'RDP', hint: 'Remote Desktop client' },
                  { value: 'both', title: 'Cả hai', hint: 'noVNC + RDP' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      const next = option.value as DesktopMode;
                      setDesktopMode(next);
                      setExposeNoVnc(next === 'novnc' || next === 'both');
                      setExposeRdp(next === 'rdp' || next === 'both');
                    }}
                    className={cn(
                      'rounded-[1rem] border p-3 text-left text-sm font-black transition',
                      desktopMode === option.value
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-slate-200/70 bg-white/70 text-slate-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-200'
                    )}
                  >
                    {option.title}
                    <span className="mt-1 block text-[11px] font-semibold leading-5 text-slate-500 dark:text-slate-400">{option.hint}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Port mở sẵn">
              <div className="grid gap-2 sm:grid-cols-3">
                <Toggle checked={exposeSsh} onChange={setExposeSsh} label="SSH 22" />
                <Toggle checked={exposeNoVnc} onChange={setExposeNoVnc} label="noVNC 6901" />
                <Toggle checked={exposeRdp} onChange={setExposeRdp} label="RDP 3389" />
              </div>
            </Field>
          </div>
        </SectionPanel>

        <SectionPanel>
          <SectionHeader eyebrow="Bước 3" title="Chọn phần mềm" description="Render có giao diện nên bật Blender + noVNC/RDP. AI có thể thêm ComfyUI, Jupyter, PyTorch." />
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {toolOptions.map((tool) => {
              const active = selectedTools.includes(tool.value);
              return (
                <button
                  key={tool.value}
                  type="button"
                  onClick={() => toggleTool(tool.value)}
                  className={cn(
                    'rounded-[1rem] border p-4 text-left transition',
                    active
                      ? 'border-emerald-500/45 bg-emerald-500/10'
                      : 'border-slate-200/70 bg-white/70 hover:border-brand-blue/25 dark:border-white/10 dark:bg-white/[0.035]'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {active ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <HardDrive className="h-4 w-4 text-slate-400" />}
                    <span className="text-sm font-black uppercase text-slate-950 dark:text-white">{tool.title}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{tool.description}</p>
                  {tool.notes ? <p className="mt-2 text-[11px] font-bold leading-5 text-amber-500">{tool.notes}</p> : null}
                </button>
              );
            })}
          </div>
        </SectionPanel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionPanel>
          <SectionHeader
            eyebrow="Bước 4"
            title="Lệnh build và push"
            description="Chạy trên máy/VPS có Docker. Sau khi push thành công, dùng tên image này trên trang VPS GPU."
            actions={
              <Button type="button" variant="outline" onClick={() => void copyText(buildCommands, 'Đã copy lệnh build/push')}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copy lệnh
              </Button>
            }
          />
          <pre className="mt-5 max-h-[360px] overflow-auto rounded-[1rem] border border-slate-200/70 bg-slate-950 p-4 text-xs font-semibold leading-6 text-cyan-50 dark:border-white/10">
            {buildCommands}
          </pre>
        </SectionPanel>

        <SectionPanel>
          <SectionHeader
            eyebrow="Dockerfile"
            title="Nội dung image"
            description="Copy Dockerfile này vào thư mục build. Anh có thể chỉnh thêm package riêng trước khi build."
            actions={
              <Button type="button" variant="outline" onClick={() => void copyText(dockerfile, 'Đã copy Dockerfile')}>
                <Clipboard className="mr-2 h-4 w-4" />
                Copy Dockerfile
              </Button>
            }
          />
          <pre className="mt-5 max-h-[520px] overflow-auto rounded-[1rem] border border-slate-200/70 bg-slate-950 p-4 text-xs font-semibold leading-6 text-cyan-50 dark:border-white/10">
            {dockerfile}
          </pre>
        </SectionPanel>
      </div>

      <SectionPanel>
        <SectionHeader eyebrow="Cách dùng" title="Đưa image vào VPS GPU" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <GuideStep icon={<ImageIcon />} title="1. Build image" description="Copy Dockerfile, build trên máy có Docker." />
          <GuideStep icon={<PackageCheck />} title="2. Push registry" description="Push lên Docker Hub hoặc GHCR để nguồn GPU kéo được." />
          <GuideStep icon={<Terminal />} title="3. Dùng image" description="Bấm Dùng image này rồi quay lại trang VPS GPU." />
          <GuideStep icon={<Play />} title="4. Tạo VPS" description="Chọn gói GPU verified, dán SSH key, tạo VPS và mở noVNC/RDP." />
        </div>
      </SectionPanel>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'rounded-[1rem] border px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em] transition',
        checked
          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
          : 'border-slate-200/70 bg-white/70 text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400'
      )}
    >
      {label}
    </button>
  );
}

function GuideStep({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Card className="rounded-[1rem] p-4">
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-brand-blue/20 bg-brand-blue/10 text-brand-blue">
        {icon}
      </div>
      <div className="mt-4 text-sm font-black uppercase text-slate-950 dark:text-white">{title}</div>
      <p className="mt-2 text-xs font-semibold leading-6 text-slate-500 dark:text-slate-400">{description}</p>
    </Card>
  );
}
