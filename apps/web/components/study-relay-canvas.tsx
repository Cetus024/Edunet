'use client';

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { ReactSketchCanvas, type ReactSketchCanvasRef } from 'react-sketch-canvas';
import { Eraser, Pencil, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COLORS = ['#0f172a', '#dc2626', '#2563eb', '#16a34a', '#ca8a04'] as const;
const SIZES = [3, 6, 10] as const;

export type StudyRelayCanvasHandle = {
  exportPngDataUrl: () => Promise<string>;
  clear: () => Promise<void>;
};

type StudyRelayCanvasProps = {
  disabled?: boolean;
  className?: string;
};

export const StudyRelayCanvas = forwardRef<StudyRelayCanvasHandle, StudyRelayCanvasProps>(
  function StudyRelayCanvas({ disabled = false, className }, ref) {
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const [strokeColor, setStrokeColor] = useState<string>(COLORS[0]);
    const [strokeWidth, setStrokeWidth] = useState<number>(SIZES[1]);
    const [eraseMode, setEraseMode] = useState(false);

    useImperativeHandle(ref, () => ({
      exportPngDataUrl: async () => {
        const dataUrl = await canvasRef.current?.exportImage('png');
        if (!dataUrl) throw new Error('Canvas export failed');
        return dataUrl;
      },
      clear: async () => {
        await canvasRef.current?.clearCanvas();
      },
    }));

    const setTool = async (erase: boolean) => {
      setEraseMode(erase);
      await canvasRef.current?.eraseMode(erase);
    };

    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={eraseMode ? 'outline' : 'default'}
            className="rounded-full"
            disabled={disabled}
            onClick={() => void setTool(false)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Pen
          </Button>
          <Button
            type="button"
            size="sm"
            variant={eraseMode ? 'default' : 'outline'}
            className="rounded-full"
            disabled={disabled}
            onClick={() => void setTool(true)}
          >
            <Eraser className="mr-1.5 h-4 w-4" /> Eraser
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() => void canvasRef.current?.undo()}
          >
            <RotateCcw className="mr-1.5 h-4 w-4" /> Undo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={disabled}
            onClick={() => void canvasRef.current?.clearCanvas()}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Clear
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Color ${color}`}
                disabled={disabled}
                className={cn(
                  'h-7 w-7 rounded-full border-2 border-transparent',
                  strokeColor === color && 'border-foreground',
                )}
                style={{ backgroundColor: color }}
                onClick={() => {
                  setStrokeColor(color);
                  void setTool(false);
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-label={`Brush ${size}`}
                disabled={disabled}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full border border-border',
                  strokeWidth === size && 'bg-secondary',
                )}
                onClick={() => setStrokeWidth(size)}
              >
                <span
                  className="rounded-full bg-foreground"
                  style={{ width: size + 2, height: size + 2 }}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-white">
          <ReactSketchCanvas
            ref={canvasRef}
            width="100%"
            height="360px"
            strokeWidth={strokeWidth}
            strokeColor={strokeColor}
            canvasColor="#ffffff"
            eraserWidth={strokeWidth * 3}
            allowOnlyPointerType="all"
            style={{ border: 'none' }}
            className={disabled ? 'pointer-events-none opacity-60' : undefined}
          />
        </div>
      </div>
    );
  },
);
