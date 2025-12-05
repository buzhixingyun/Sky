import { translations } from './translations';

export interface CalculationResult {
  current: number;
  tallest: number;
  shortest: number;
  scale: number;
  timestamp: number;
  note: string;
  json: {
    height_raw: number;
    scale_raw: number;
  };
  error?: string;
}

export const decodeAndCalculate = (rawData: string): CalculationResult | { error: string } => {
    try {
        const startMarker = "ImJvZHki";
        const startIndex = rawData.indexOf(startMarker);
        if (startIndex === -1) {
            return { error: translations['status_error_general'] };
        }

        let b64Str = rawData.substring(startIndex);
        b64Str = b64Str.replace(/-/g, '+').replace(/_/g, '/');
        const padding = b64Str.length % 4;
        if (padding) {
            b64Str += '='.repeat(4 - padding);
        }

        const decodedText = atob(b64Str);
        let height;
        const heightKeyMatch = decodedText.match(/eigh/i);
        if (!heightKeyMatch) {
            return { error: translations['status_error_general'] };
        }

        const heightSearchArea = decodedText.substring(heightKeyMatch.index! + heightKeyMatch[0].length);
        const heightMatch = heightSearchArea.match(/(-?\d*\.\d+|-?\d+\.?\d*)/);
        if (heightMatch) {
            height = parseFloat(heightMatch[1]);
        } else {
            return { error: translations['status_error_general'] };
        }

        let scale;
        const scaleKeyMatch = decodedText.match(/scale/i);
        if (!scaleKeyMatch) {
            return { error: translations['status_error_general'] };
        }

        const scaleSearchArea = decodedText.substring(scaleKeyMatch.index! + scaleKeyMatch[0].length);
        const scientificMatch = scaleSearchArea.match(/[":]*(-?\d+\.?\d*)[eE]([-+]?\d+)/);
        
        if (scientificMatch) {
            const base = parseFloat(scientificMatch[1]);
            const exponent = parseInt(scientificMatch[2]);
            scale = base * Math.pow(10, exponent);
        } else {
            const standardFloatMatch = scaleSearchArea.match(/[":]*(-?\d*\.\d+)/);
            if (standardFloatMatch) {
                scale = parseFloat(standardFloatMatch[1]);
            } else {
                let integerMatch = null;
                const searchWindow = scaleSearchArea.substring(0, 30);
                integerMatch = searchWindow.match(/^.*?(\d{1,10})/);

                if (integerMatch) {
                    const scaleInt = parseInt(integerMatch[1]);
                    scale = scaleInt / 1000000000.0;
                } else {
                    return { error: translations['status_error_general'] };
                }
            }
        }

        const currentHeight = 7.6 - (8.3 * scale) - (3 * height);
        const shortestHeight = 7.6 - (8.3 * scale) - (3 * -2.0);
        const tallestHeight = 7.6 - (8.3 * scale) - (3 * 2.0);

        const jsonResult = {
            height_raw: height,
            scale_raw: scale
        };

        return {
            current: currentHeight,
            tallest: tallestHeight,
            shortest: shortestHeight,
            scale: scale,
            timestamp: new Date().getTime(),
            note: "",
            json: jsonResult
        };
    } catch (e) {
        console.error("Calculation failed:", e);
        return { error: translations['status_error_general'] };
    }
}