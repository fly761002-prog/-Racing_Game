/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question } from '../types/game';
import { AudioManager } from '../audio/AudioManager';
import { useGameStore } from '../store/useGameStore';

// Interface definitions for the 3D Pseudo Engine
export interface SegmentPoint {
  world: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number };
}

export interface SpriteInstance {
  id: string;
  x: number; // -1 to 1 is on road, outside is roadside
  type: 'tree' | 'tree_pink' | 'building' | 'house' | 'cone' | 'barrier' | 'crate' | 'neon_sign' | 'tax_info_board' | 'gift' | 'wind_turbine' | 'drone';
  scale: number;
  width: number;
  hit: boolean;
  text?: string;
}

export interface GateInstance {
  question: Question;
  triggered: boolean;
  yOffset: number; // floating animation
}

export interface Segment {
  index: number;
  p1: SegmentPoint;
  p2: SegmentPoint;
  curve: number;
  loopCurveSum: number; // accumulated curve for drawing
  color: {
    road: string;
    grass: string;
    rumble: string;
    lane?: string;
  };
  sprites: SpriteInstance[];
  gate?: GateInstance;
  finishLine?: boolean;
}

export interface AICar {
  id: string;
  name: string;
  color: string;
  x: number; // -0.8 to 0.8
  z: number;
  speed: number;
  accuracy: number; // 0.6 to 0.9
  targetX: number;
  lastDecisionTime: number;
  width: number;
  laps?: number;
  score?: number;
  combo?: number;
  correctAnswers?: number;
  totalAnswered?: number;
  passedGates?: { [gateIndex: number]: boolean };
}

export class Pseudo3DRacer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // Game assets / styles
  private carColor: string = '#ef4444';
  
  // Track parameters
  private segments: Segment[] = [];
  private segmentLength = 200; // length of each road segment
  private roadWidth = 2000;
  private lanes = 3;
  private segmentCount = 2400; // loop track total segments
  
  // Camera & Player parameters
  private cameraHeight = 1000;
  private cameraDepth = 0.8; // FOV
  private drawDistance = 300; // how many segments to render forward
  
  public playerX = 0; // -1 to 1
  public playerZ = 0; // position along track
  public speed = 0;
  private maxSpeed = 160; // max units per frame (relative)
  private accel = 1.2;
  private decel = -1.5;
  private braking = -4.0;
  private offRoadDecel = -8.0;
  private offRoadLimit = 50; // speed limit on grass
  
  // Steering parameters
  private steeringSens = 0.045;
  private turnSpeedRatio = 0.0005; // how much turn is affected by speed
  
  // Input states
  private keys: { [key: string]: boolean } = {};
  private playerLaps = 0;
  
  // Dynamic entities
  private aiCars: AICar[] = [];
  
  // Game Engine state callbacks
  private onAnswer: (option: 'A' | 'B') => { isCorrect: boolean; explanation: string } = () => ({ isCorrect: true, explanation: '' });
  private onObstacleHit: () => void = () => {};
  private currentQuestionSupplier: () => Question | null = () => null;
  
  // Animation & Frame-rate control
  private lastTime = 0;
  private animFrameId: number | null = null;
  private width = 800;
  private height = 500;
  
  // UI indicators
  private cameraShakeIntensity = 0;
  private flashColor: string | null = null;
  private flashDuration = 0;
  
  // Sky scrolling offset
  private skyOffset = 0;
  
  // Speed boost timer
  private boostTimeRemaining = 0;
  private slowdownTimeRemaining = 0;

  // Completion/Target rankings state
  private targetFinishOrder: string[] | null = null;
  private completionTimeElapsed = 0;
  private finishLinePlaced = false;
  private startingDistances: { [id: string]: number } = {};
  private startingPlayerDist = 0;
  
  constructor(
    canvas: HTMLCanvasElement,
    carColor: string,
    onAnswer: (option: 'A' | 'B') => { isCorrect: boolean; explanation: string },
    onObstacleHit: () => void,
    currentQuestionSupplier: () => Question | null
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context');
    this.ctx = context;
    
    this.carColor = carColor;
    this.onAnswer = onAnswer;
    this.onObstacleHit = onObstacleHit;
    this.currentQuestionSupplier = currentQuestionSupplier;
    
    this.resize();
    this.setupTrack();
    this.setupAICars();
    this.setupInput();
  }

  public resize() {
    this.width = this.canvas.parentElement?.clientWidth || 800;
    this.height = this.canvas.parentElement?.clientHeight || 500;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    
    // Adjust depth based on aspect ratio
    this.cameraDepth = 1.0 / Math.tan((60 * Math.PI) / 360); // approx 60deg FOV
  }

  public updateCarColor(color: string) {
    this.carColor = color;
  }

  // Define track properties
  private setupTrack() {
    this.segments = [];
    
    // Color definitions for alternating striping (High contrast neon theme)
    const colors = {
      light: { road: '#2a2d42', grass: '#010103', rumble: '#ff3366', lane: '#ffcc00' }, 
      dark: { road: '#1e202f', grass: '#010103', rumble: '#00ff88' }
    };
    
    const taxInfoSlogans = [
      "誠實申報娛樂稅，地方建設最完備！",
      "KTV、電影院、夾娃娃機皆代徵娛樂稅！",
      "慈善義演全捐贈，符合規定免課稅！",
      "娛樂稅為地方稅，建設鄉里更精粹！",
      "舞廳舞場法定最高稅率達 100%！",
      "電競售票競技，同樣申報娛樂稅！",
      "網咖提供線上娛樂，需課徵娛樂稅！"
    ];

    let currentSloganIndex = 0;

    for (let i = 0; i < this.segmentCount; i++) {
      const isEven = Math.floor(i / 3) % 2 === 0;
      const roadColor = isEven ? colors.light.road : colors.dark.road;
      const grassColor = isEven ? colors.light.grass : colors.dark.grass;
      const rumbleColor = isEven ? colors.light.rumble : colors.dark.rumble;
      const laneColor = isEven ? colors.light.lane : 'rgba(255, 204, 0, 0.25)';
      
      // Track curve generation (creating modular turns)
      let curve = 0;
      if (i > 100 && i < 220) curve = 1.5; // right turn
      if (i > 300 && i < 420) curve = -2.0; // sharp left
      if (i > 500 && i < 680) curve = 0.8; // gentle right
      if (i > 750 && i < 900) curve = -1.2; // medium left
      if (i > 950 && i < 1120) curve = 2.5; // sharp winding right
      if (i > 1200 && i < 1320) curve = -2.2; // deep sharp left
      if (i > 1400 && i < 1550) curve = Math.sin((i - 1400) / 30) * 2.0; // dynamic winding S-curve
      if (i > 1650 && i < 1800) curve = 1.8; // sweeping long right
      if (i > 1850 && i < 2000) curve = -3.2; // dramatic hairpin left turn
      if (i > 2050 && i < 2200) curve = Math.sin((i - 2050) / 40) * 1.5; // gentle S-curves
      if (i > 2250 && i < 2380) curve = 2.0; // winding snake road right

      const segment: Segment = {
        index: i,
        p1: {
          world: { x: 0, y: this.getElevationY(i), z: i * this.segmentLength },
          screen: { x: 0, y: 0, w: 0 }
        },
        p2: {
          world: { x: 0, y: this.getElevationY(i + 1), z: (i + 1) * this.segmentLength },
          screen: { x: 0, y: 0, w: 0 }
        },
        curve,
        loopCurveSum: 0,
        color: { road: roadColor, grass: grassColor, rumble: rumbleColor, lane: laneColor },
        sprites: []
      };

      // Generate road-side decors (spacious, clean cyberpunk scenery: trees, pink sakura, buildings, houses, wind turbines, drones, neon boards, gifts)
      if (i % 12 === 0 && i > 15) {
        const index = Math.floor(i / 12);
        // Alternating side strictly to keep the screen uncluttered and clean
        const sideFactor = index % 2 === 0 ? -1 : 1;
        const sides = [sideFactor];

        sides.forEach((sideFactor) => {
          // Choose sprite type based on index
          // 0: tree, 1: tree_pink, 2: building, 3: house, 4: tax_info_board, 5: wind_turbine, 6: drone, 7: neon_sign, 8: gift
          const typeVal = index % 9;
          
          let spriteType: 'tree' | 'tree_pink' | 'building' | 'house' | 'tax_info_board' | 'wind_turbine' | 'drone' | 'neon_sign' | 'gift' = 'tree';
          let scale = 1.2;
          let width = 600;
          let sideOffset = 1.8;
          let text: string | undefined = undefined;

          if (typeVal === 0) {
            spriteType = 'tree';
            scale = 1.2;
            width = 600;
            sideOffset = 1.7;
          } else if (typeVal === 1) {
            spriteType = 'tree_pink';
            scale = 1.25;
            width = 600;
            sideOffset = 1.7;
          } else if (typeVal === 2) {
            spriteType = 'building';
            scale = 2.4;
            width = 750;
            sideOffset = 2.6; // further back for monumental view
          } else if (typeVal === 3) {
            spriteType = 'house';
            scale = 1.4;
            width = 650;
            sideOffset = 1.9;
          } else if (typeVal === 4) {
            spriteType = 'tax_info_board';
            scale = 1.5;
            width = 700;
            sideOffset = 2.0;
            text = taxInfoSlogans[currentSloganIndex % taxInfoSlogans.length];
            currentSloganIndex++;
          } else if (typeVal === 5) {
            spriteType = 'wind_turbine';
            scale = 2.2;
            width = 600;
            sideOffset = 2.2;
          } else if (typeVal === 6) {
            spriteType = 'drone';
            scale = 0.9;
            width = 500;
            sideOffset = 1.6; // Hovers closer to the road for visibility
          } else if (typeVal === 7) {
            spriteType = 'neon_sign';
            scale = 1.6;
            width = 650;
            sideOffset = 1.8;
          } else {
            spriteType = 'gift';
            scale = 1.0;
            width = 500;
            sideOffset = 1.6;
          }

          segment.sprites.push({
            id: `decor_${i}_side_${sideFactor}`,
            x: sideOffset * sideFactor,
            type: spriteType,
            scale: scale,
            width: width,
            hit: false,
            text: text
          });
        });
      }

      this.segments.push(segment);
    }

    // Embed QUIZ GATES on track
    // Place them periodically, e.g., every 450 segments (increased distance to prolong gameplay)
    const quizDistance = 450; 
    let gateCount = 0;
    
    for (let g = quizDistance; g < this.segmentCount; g += quizDistance) {
      if (g >= this.segments.length) break;
      
      const question = this.currentQuestionSupplier();
      if (question) {
        this.segments[g].gate = {
          question: question,
          triggered: false,
          yOffset: 0
        };
        gateCount++;
      }
    }
    console.log(`Generated track with ${this.segments.length} segments and ${gateCount} quiz gates.`);
  }

  // Get pseudo-3D hill elevations with a highly dynamic rollercoaster profile
  private getElevationY(index: number): number {
    const i = index % this.segmentCount;
    let y = 0;
    
    // Smooth, exciting vertical curves
    if (i >= 120 && i <= 250) {
      // Gentle warm-up hill
      y = Math.sin((i - 120) / 130 * Math.PI) * 450;
    } else if (i >= 300 && i <= 500) {
      // Rapid bumps / high-speed ripple hills for intense feedback
      y = Math.sin((i - 300) / 50 * Math.PI * 2) * 200;
    } else if (i >= 550 && i <= 750) {
      // Giant mountain peak with massive roller coaster dip!
      y = Math.sin((i - 550) / 200 * Math.PI) * 900;
    } else if (i >= 800 && i <= 1000) {
      // Medium rolling waves
      y = Math.sin((i - 800) / 100 * Math.PI * 2) * 400;
    } else if (i >= 1100 && i <= 1350) {
      // Steep valley plunge and climb-out
      y = -Math.sin((i - 1100) / 250 * Math.PI) * 650;
    } else if (i >= 1400 && i <= 1650) {
      // Double camel-hump hills
      y = Math.sin((i - 1400) / 125 * Math.PI * 2) * 550;
    } else if (i >= 1700 && i <= 1950) {
      // Massive alpine ascent and high-speed vertical drop!
      y = Math.sin((i - 1700) / 250 * Math.PI) * 1100;
    } else if (i >= 2000 && i <= 2200) {
      // High-speed low-vibration humps
      y = Math.sin((i - 2000) / 66.7 * Math.PI * 2) * 180;
    }
    
    return y;
  }

  // Setup 3 AI Opponents
  private setupAICars() {
    this.aiCars = [
      {
        id: 'ai_1',
        name: '稅法老司機',
        color: '#f59e0b', // Amber-500
        x: -0.5,
        z: 120,
        speed: 110,
        accuracy: 0.90, // 90% correct
        targetX: -0.5,
        lastDecisionTime: 0,
        width: 400,
        laps: 0,
        score: 0,
        combo: 0,
        correctAnswers: 0,
        totalAnswered: 0,
        passedGates: {}
      },
      {
        id: 'ai_2',
        name: '極速小稅官',
        color: '#10b981', // Emerald-500
        x: 0.5,
        z: 240,
        speed: 95,
        accuracy: 0.75, // 75% correct
        targetX: 0.5,
        lastDecisionTime: 0,
        width: 400,
        laps: 0,
        score: 0,
        combo: 0,
        correctAnswers: 0,
        totalAnswered: 0,
        passedGates: {}
      },
      {
        id: 'ai_3',
        name: '新手菜鳥號',
        color: '#8b5cf6', // Violet-500
        x: 0.15,
        z: 20,
        speed: 85,
        accuracy: 0.60, // 60% correct
        targetX: 0.15,
        lastDecisionTime: 0,
        width: 400,
        laps: 0,
        score: 0,
        combo: 0,
        correctAnswers: 0,
        totalAnswered: 0,
        passedGates: {}
      }
    ];
  }

  // Setup keyboard event listeners
  private setupInput() {
    window.addEventListener('keydown', (e) => {
      let key = e.key.toLowerCase();
      if (key === 'arrowup') key = 'w';
      if (key === 'arrowdown') key = 's';
      if (key === 'arrowleft') key = 'a';
      if (key === 'arrowright') key = 'd';
      this.keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
      let key = e.key.toLowerCase();
      if (key === 'arrowup') key = 'w';
      if (key === 'arrowdown') key = 's';
      if (key === 'arrowleft') key = 'a';
      if (key === 'arrowright') key = 'd';
      this.keys[key] = false;
    });
  }

  // Project 3D coordinates into 2D screenspace
  private projectPoint(
    p: SegmentPoint,
    cameraX: number,
    cameraY: number,
    cameraZ: number,
    dx: number,
    dy: number
  ) {
    const storeState = useGameStore.getState();
    const isCinematicCamera = storeState.isCompleting && this.completionTimeElapsed >= 2.5;

    if (isCinematicCamera) {
      // Cinematic trailing/chase camera that drifts slowly from side-to-side to frame overtaking scenes beautifully
      const cinematicT = Math.min(1.0, (this.completionTimeElapsed - 2.5) / 6.0);
      const theta = -0.15 + cinematicT * 0.45;
      
      // Steady chase distance behind player's car
      const D = 1800;
      
      // Medium elevation looking down on the road to prevent cars overlapping each other
      const H = 650;
      
      const playerX_abs = this.playerX * this.roadWidth;
      const playerY_abs = cameraY - this.cameraHeight; // cameraY is interpolatedY + cameraHeight
      const playerZ_abs = this.playerZ;
      
      // Adjust point's Z if it has looped around during projection range
      let ptZ = p.world.z;
      if (ptZ < playerZ_abs - 5000) {
        ptZ += this.segmentCount * this.segmentLength;
      } else if (ptZ > playerZ_abs + this.segmentCount * this.segmentLength - 5000) {
        ptZ -= this.segmentCount * this.segmentLength;
      }
      
      const X_rel = (p.world.x + dx) - playerX_abs;
      const Y_rel = p.world.y - playerY_abs;
      const Z_rel = ptZ - playerZ_abs;
      
      // Rotate in the X-Z horizontal plane around the player's car
      const transX = X_rel * Math.cos(theta) - Z_rel * Math.sin(theta);
      const transY = Y_rel - H;
      const transZ = X_rel * Math.sin(theta) + Z_rel * Math.cos(theta) + D;
      
      if (transZ <= 0) {
        p.screen.x = 0;
        p.screen.y = 0;
        p.screen.w = 0;
        return;
      }
      
      const scale = this.cameraDepth / transZ;
      p.screen.x = Math.round((this.width / 2) + (scale * transX * this.width / 2));
      p.screen.y = Math.round((this.height / 2) - (scale * transY * this.height / 2));
      p.screen.w = Math.round(scale * this.roadWidth * this.width / 2);
    } else {
      // Normal projection
      const transX = p.world.x - cameraX + dx;
      const transY = p.world.y - cameraY + dy;
      const transZ = p.world.z - cameraZ;
      
      if (transZ <= 0) {
        p.screen.x = 0;
        p.screen.y = 0;
        p.screen.w = 0;
        return;
      }
      
      const scale = this.cameraDepth / transZ;
      p.screen.x = Math.round((this.width / 2) + (scale * transX * this.width / 2));
      p.screen.y = Math.round((this.height / 2) - (scale * transY * this.height / 2));
      p.screen.w = Math.round(scale * this.roadWidth * this.width / 2);
    }
  }

  // Find segment at specific Z coordinate
  private findSegment(z: number): Segment {
    if (!this.segments || this.segments.length === 0) {
      return {
        index: 0,
        p1: { world: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0 } },
        p2: { world: { x: 0, y: 0, z: 0 }, screen: { x: 0, y: 0, w: 0 } },
        curve: 0,
        loopCurveSum: 0,
        sprites: [],
        color: { road: '#000', grass: '#000', rumble: '#000', lane: '#000' }
      };
    }
    let index = Math.floor(z / this.segmentLength) % this.segments.length;
    if (isNaN(index)) {
      index = 0;
    }
    if (index < 0) {
      index += this.segments.length;
    }
    const seg = this.segments[index];
    if (!seg) {
      return this.segments[0];
    }
    return seg;
  }

  // Game loop trigger
  public start() {
    this.lastTime = performance.now();
    const loop = (timestamp: number) => {
      const dt = Math.min(100, timestamp - this.lastTime) / 1000; // cap delta time
      this.lastTime = timestamp;
      
      this.update(dt);
      this.render();
      
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // Handle game physics & logic
  private update(dt: number) {
    if (useGameStore.getState().showFeedbackModal) {
      // 答錯暫停物理與車速更新
      return;
    }

    const storeState = useGameStore.getState();
    const isCompleting = storeState.isCompleting;

    // Scale dt depending on the completion phase
    let physicsDt = dt;
    if (isCompleting) {
      if (this.completionTimeElapsed < 2.5) {
        physicsDt = dt * 1.0; // Phase 1: Keep full normal speed in first-person view to approach finish line seamlessly!
      } else if (this.completionTimeElapsed >= 2.5 && this.completionTimeElapsed < 5.5) {
        physicsDt = dt * 0.30; // Phase 2: Cinematic Bullet-Time slow-motion crossing!
      } else {
        physicsDt = dt * 0.40; // Phase 3: Post-cross smooth slow-motion deceleration drift cooldown!
      }
    }

    const currentSegment = this.findSegment(this.playerZ);
    const speedPercent = this.speed / this.maxSpeed;
    
    // 更新引擎聲 pitch & volume 隨車速連動
    AudioManager.getInstance().updateEngine(speedPercent);
    
    // 1. Sky Scrolling
    this.skyOffset = (this.skyOffset + currentSegment.curve * 0.05 * speedPercent) % 1;
    
    // 2. Camera Shake / HUD flash update
    if (this.cameraShakeIntensity > 0) {
      this.cameraShakeIntensity -= physicsDt * 10;
    }
    if (this.flashDuration > 0) {
      this.flashDuration -= physicsDt;
      if (this.flashDuration <= 0) this.flashColor = null;
    }

    // 3. Movement controls
    const isOffRoad = Math.abs(this.playerX) > 1.0;

    // Check if speed boost or game completion is active
    let currentMaxSpeed = this.maxSpeed;
    let currentAccel = this.accel;
    
    if (this.boostTimeRemaining > 0) {
      this.boostTimeRemaining -= physicsDt;
      currentMaxSpeed = this.maxSpeed * 1.5; // 提高最高時速
      currentAccel = this.accel * 4.0;       // 提高起步/加速速率
    }

    if (this.slowdownTimeRemaining > 0) {
      this.slowdownTimeRemaining -= physicsDt;
      currentMaxSpeed = this.maxSpeed * 0.25; // 限制最高速為 25%
      currentAccel = this.decel * 6.0;        // 強制快速減速
    }

    if (isCompleting) {
      // Smoothly steer player to their designated lane based on final rank
      const playerIndex = this.targetFinishOrder ? this.targetFinishOrder.indexOf('player') : 2;
      let targetPlayerX = 0;
      if (playerIndex === 0) targetPlayerX = -0.6;
      else if (playerIndex === 1) targetPlayerX = -0.2;
      else if (playerIndex === 2) targetPlayerX = 0.2;
      else targetPlayerX = 0.6;

      const diffX = targetPlayerX - this.playerX;
      this.playerX += diffX * 2.0 * physicsDt;
      if (this.completionTimeElapsed < 5.5) {
        // Lock speed to max speed for perfect finish line prediction during Phase 1 & 2
        this.speed = Math.max(100, this.maxSpeed);
      } else {
        // Phase 3: Smoothly decelerate after crossing the finish line
        this.speed = Math.max(15, this.speed - this.decel * 1.5 * 60 * physicsDt);
      }
    } else {
      // 自動行駛：車子隨時都在全速前進 (auto-acceleration)
      this.speed += currentAccel * 60 * physicsDt;

      // Handle offroad penalties (driving on grass) with smooth deceleration
      if (isOffRoad) {
        if (this.speed > this.offRoadLimit) {
          this.speed += this.offRoadDecel * 60 * physicsDt;
        }
      }

      // Steer left & right (smooth frame-rate independent)
      if (this.speed > 0) {
        // Dynamic steering based on current velocity
        const steeringAmount = this.steeringSens * (this.speed * this.turnSpeedRatio + 0.35) * 60 * physicsDt;
        
        // Auto select answer on key press / steering input
        const store = useGameStore.getState();
        const selected = store.selectedAnswer;
        
        if (this.keys['a']) {
          if (selected !== 'A') {
            store.selectAnswer('A');
          }
        } else if (this.keys['d']) {
          if (selected !== 'B') {
            store.selectAnswer('B');
          }
        }

        // Re-read selected state
        const currentSelected = useGameStore.getState().selectedAnswer;

        if (currentSelected === 'A') {
          const targetX = -0.55; // Left gate center
          const diff = targetX - this.playerX;
          // Auto-steer towards Left gate lane
          const step = Math.sign(diff) * Math.min(Math.abs(diff), steeringAmount * 1.5);
          this.playerX += step;
        } else if (currentSelected === 'B') {
          const targetX = 0.55; // Right gate center
          const diff = targetX - this.playerX;
          // Auto-steer towards Right gate lane
          const step = Math.sign(diff) * Math.min(Math.abs(diff), steeringAmount * 1.5);
          this.playerX += step;
        } else {
          // Normal manual control if no answer is selected yet
          if (this.keys['a']) {
            this.playerX -= steeringAmount;
          }
          if (this.keys['d']) {
            this.playerX += steeringAmount;
          }
        }
      }

      // Smooth speed cap when exceeding current max speed (e.g. glide down when boost ends instead of instant hard-drop)
      if (this.speed > currentMaxSpeed) {
        this.speed += this.decel * 3.0 * 60 * physicsDt; // smooth decay back to max speed
        if (this.speed < currentMaxSpeed) this.speed = currentMaxSpeed;
      } else {
        this.speed = Math.max(0, Math.min(currentMaxSpeed, this.speed));
      }
    }

    this.playerX = Math.max(-2.5, Math.min(2.5, this.playerX)); // boundary

    // 4. Progress along track
    this.playerZ += this.speed * 60 * physicsDt; // relative scale unit
    const totalTrackLength = this.segmentCount * this.segmentLength;
    if (this.playerZ >= totalTrackLength) {
      this.playerZ -= totalTrackLength;
      this.playerLaps++;
    }

    // 5. Update AI Opponents
    // We pass dt (the real unscaled dt) here because updateAICars tracks actual elapsed seconds
    this.updateAICars(dt);

    // Calculate and update the real-time rank and final rankings list
    const playerDist = this.playerLaps * totalTrackLength + this.playerZ;
    const standings = this.aiCars.map(car => ({
      id: car.id,
      dist: (car.laps || 0) * totalTrackLength + car.z
    }));
    standings.push({ id: 'player', dist: playerDist });
    standings.sort((a, b) => b.dist - a.dist);
    const playerRank = standings.findIndex(item => item.id === 'player') + 1;
    useGameStore.getState().setRealtimeRank(playerRank);

    // Build the complete rankings structure for use in the game-over screen
    const { score: playerStoreScore, correctAnswers, totalAnswered, settings } = useGameStore.getState();
    const playerAccuracy = totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : 0;

    const rankingsList = standings.map((item) => {
      if (item.id === 'player') {
        return {
          id: 'player',
          name: `${settings.playerName} (您)`,
          score: playerStoreScore,
          accuracy: playerAccuracy,
          isPlayer: true,
          color: 'text-yellow-400 font-extrabold',
          dist: item.dist
        };
      } else {
        const car = this.aiCars.find(c => c.id === item.id);
        const carName = car ? car.name : '未知代徵人';
        const carAccuracy = car && car.totalAnswered && car.totalAnswered > 0 
          ? Math.round((car.correctAnswers || 0) / car.totalAnswered * 100) 
          : (car ? Math.round(car.accuracy * 100) : 70);
        
        const aiScore = car ? (car.score || 0) : 40;

        return {
          id: item.id,
          name: carName,
          score: aiScore,
          accuracy: carAccuracy,
          isPlayer: false,
          color: item.id === 'ai_1' ? 'text-amber-400' : item.id === 'ai_2' ? 'text-emerald-400' : 'text-violet-400',
          dist: item.dist
        };
      }
    });

    useGameStore.getState().setFinalRankings(rankingsList);
    
    // Update real-time speed in store (especially for mobile HUD)
    const speedKmh = Math.round(this.speed * 2.2);
    useGameStore.getState().setCurrentSpeed(speedKmh);

    // 6. Collision & Event Check
    this.checkCollisions(currentSegment);
  }

  // Update AI racer positions and simulate responses
  private updateAICars(dt: number) {
    const storeState = useGameStore.getState();
    const isCompleting = storeState.isCompleting;
    const totalTrackLength = this.segmentCount * this.segmentLength;

    if (isCompleting) {
      if (!this.targetFinishOrder) {
        this.completionTimeElapsed = 0;
        const correctCount = storeState.correctAnswers;
        let targetRank = 4;
        if (correctCount === 10) {
          targetRank = 1;
        } else if (correctCount === 9) {
          targetRank = 2;
        } else if (correctCount >= 5 && correctCount <= 8) {
          // Randomly select 3rd or 4th place
          targetRank = Math.random() < 0.5 ? 3 : 4;
        } else {
          targetRank = 4;
        }

        // Order the AI cars by their normal strength/accuracy: Best is ai_1, then ai_2, then ai_3
        const aiOrder = ['ai_1', 'ai_2', 'ai_3'];
        const order: string[] = [];
        let aiIdx = 0;
        for (let r = 1; r <= 4; r++) {
          if (r === targetRank) {
            order.push('player');
          } else {
            order.push(aiOrder[aiIdx++]);
          }
        }
        this.targetFinishOrder = order;

        // Save starting distances for smooth interpolation
        this.startingPlayerDist = this.playerLaps * totalTrackLength + this.playerZ;
        this.aiCars.forEach(c => {
          this.startingDistances[c.id] = (c.laps || 0) * totalTrackLength + c.z;
        });

        // Clean up any old finish line flags
        this.segments.forEach(s => s.finishLine = false);

        // Place a finish line ahead
        // Phase 1 (normal speed): 0 to 2.5s real-time. Speed factor is 1.0. Physics elapsed = 2.5 * 1.0 = 2.5s
        // Phase 2 (slow-motion bullet finish): 2.5 to 5.5s real-time. Speed factor is 0.30. Physics elapsed = 3.0 * 0.30 = 0.9s
        // Total effective physics duration before crossing = 2.5 + 0.9 = 3.4 seconds.
        const finishLineDistance = 3.4 * 60 * Math.max(100, this.maxSpeed);
        const finishLineAbsZ = (this.playerLaps * totalTrackLength + this.playerZ) + finishLineDistance;
        const targetSegIndex = Math.floor(finishLineAbsZ / this.segmentLength) % this.segmentCount;
        this.segments[targetSegIndex].finishLine = true;
      }

      this.completionTimeElapsed += dt;

      // Check if we crossed the finish line at exactly 5.5s (real-time)
      if (this.completionTimeElapsed >= 5.5 && !storeState.crossedFinishLine) {
        useGameStore.getState().setCrossedFinishLine(true);
        const am = AudioManager.getInstance();
        am.play('combo_up', { pitch: 1.15 });
        setTimeout(() => {
          am.play('correct', { pitch: 1.3 });
        }, 150);
      }

      const t = Math.min(1.0, this.completionTimeElapsed / 4.5); // 4.5s duration to reach target rank smoothly in slow motion

      const playerIndex = this.targetFinishOrder.indexOf('player');
      const playerDist = this.playerLaps * totalTrackLength + this.playerZ;
      const startingPlayerDist = this.startingPlayerDist;

      this.aiCars.forEach((car) => {
        const i = this.targetFinishOrder!.indexOf(car.id);
        // Space out cars clearly with 380m gaps so they stay in a beautiful, tight pack on screen
        const targetDist = playerDist + (playerIndex - i) * 380;

        const startDist = this.startingDistances[car.id] !== undefined ? this.startingDistances[car.id] : ((car.laps || 0) * totalTrackLength + car.z);
        const baseRelativeDist = startDist + (playerDist - startingPlayerDist);

        const finalDist = baseRelativeDist + (targetDist - baseRelativeDist) * t;

        car.z = finalDist % totalTrackLength;
        if (car.z < 0) car.z += totalTrackLength;
        car.laps = Math.floor(finalDist / totalTrackLength);

        // Smoothly assign distinct horizontal lanes for each car to prevent overlay blocking
        let targetX = 0;
        if (i === 0) targetX = -0.6;
        else if (i === 1) targetX = -0.2;
        else if (i === 2) targetX = 0.2;
        else targetX = 0.6;
        car.x = car.x + (targetX - car.x) * t * 0.1; // interpolate smoothly

        // Keep wheel spin speed natural
        car.speed = this.speed + (playerIndex - i) * 15;
      });

      return;
    } else {
      this.targetFinishOrder = null;
    }

    // Normal AI Updates with player-correctness dynamic adaptivity
    const pCorrect = storeState.correctAnswers;
    const pTotal = storeState.totalAnswered;
    let aiSpeedMod = 1.0;
    if (pTotal > 0) {
      const accuracy = pCorrect / pTotal;
      if (accuracy >= 0.9) {
        aiSpeedMod = 0.80; // Slow down AI so player takes lead easily
      } else if (accuracy >= 0.7) {
        aiSpeedMod = 0.90; // Slow down AI slightly so player is 2nd or better
      } else if (accuracy >= 0.5) {
        aiSpeedMod = 1.05; // Standard competitive speed
      } else {
        aiSpeedMod = 1.25; // Speed up AI to push player to back
      }
    }

    this.aiCars.forEach((car) => {
      const carSegment = this.findSegment(car.z);
      
      const playerDist = this.playerLaps * totalTrackLength + this.playerZ;
      const aiDist = (car.laps || 0) * totalTrackLength + car.z;
      const distDiff = playerDist - aiDist; // Positive: Player is ahead of AI. Negative: AI is ahead.

      // Base target speed of the AI
      let baseTargetSpeed = 100;
      if (car.id === 'ai_1') baseTargetSpeed = 118;
      if (car.id === 'ai_2') baseTargetSpeed = 108;
      if (car.id === 'ai_3') baseTargetSpeed = 98;

      baseTargetSpeed *= aiSpeedMod;

      // Adjust AI speed dynamically to create exciting back-and-forth overtaking!
      // We want to keep the AI close to the player, making them pass each other.
      let rubberBandSpeed = baseTargetSpeed;

      // Player current speed
      const pSpeed = this.speed;

      if (distDiff > 0) {
        // Player is ahead of this AI
        if (distDiff < 1500) {
          // AI is close behind the player. Give it an aggressive drafting/overtake boost to try and pass the player!
          rubberBandSpeed = pSpeed + 24 + Math.sin(performance.now() / 800) * 15;
        } else if (distDiff < 4000) {
          // AI is moderately behind. Catch up rapidly!
          rubberBandSpeed = pSpeed + 16 + Math.random() * 8;
        } else {
          // AI is far behind. Strong rubber-band catch up!
          rubberBandSpeed = pSpeed + 35 + Math.random() * 15;
        }
      } else {
        // AI is ahead of the player (distDiff <= 0)
        const absDiff = Math.abs(distDiff);
        if (absDiff < 1500) {
          // AI is just slightly ahead of the player. Maintain a highly competitive, back-and-forth speed!
          rubberBandSpeed = pSpeed * 0.98 + 18 + Math.sin(performance.now() / 1000) * 12;
        } else if (absDiff < 4000) {
          // AI is moderately ahead. Slow down slightly to let the player challenge them again!
          rubberBandSpeed = Math.max(80, pSpeed - 8);
        } else {
          // AI is far ahead. Slow down significantly to bring them back into visual chase!
          rubberBandSpeed = Math.max(65, pSpeed - 22);
        }
      }

      // Scale rubber-banding speed with player performance mod
      rubberBandSpeed *= aiSpeedMod;

      // Add small sinusoidal speed waves to make their movement look organic and unpredictable
      const wave = Math.sin((performance.now() / 1500) + (car.id === 'ai_1' ? 0 : car.id === 'ai_2' ? 2 : 4)) * 14;
      let finalTargetSpeed = rubberBandSpeed + wave;

      // Ensure speeds stay within reasonable limits (e.g. min 40, max 230)
      finalTargetSpeed = Math.max(40, Math.min(230, finalTargetSpeed));

      // Accelerate / decelerate towards finalTargetSpeed smoothly
      const accelRate = 2.5; // speed change per frame
      if (car.speed < finalTargetSpeed) {
        car.speed += accelRate * 60 * dt;
        if (car.speed > finalTargetSpeed) car.speed = finalTargetSpeed;
      } else if (car.speed > finalTargetSpeed) {
        car.speed -= accelRate * 1.5 * 60 * dt;
        if (car.speed < finalTargetSpeed) car.speed = finalTargetSpeed;
      }
      
      car.z += car.speed * 60 * dt;
      if (car.z >= totalTrackLength) {
        car.z -= totalTrackLength;
        car.laps = (car.laps || 0) + 1;
      }

      // Calculate dynamic score updates when crossing quiz gates
      const totalCarDist = (car.laps || 0) * totalTrackLength + car.z;
      const quizDistUnits = 450 * this.segmentLength; // quizDistance * segmentLength
      const currentGateIndex = Math.floor(totalCarDist / quizDistUnits);
      if (!car.passedGates) car.passedGates = {};
      if (currentGateIndex > 0 && !car.passedGates[currentGateIndex]) {
        car.passedGates[currentGateIndex] = true;
        car.totalAnswered = (car.totalAnswered || 0) + 1;
        const isCorrect = Math.random() < car.accuracy;
        if (isCorrect) {
          car.correctAnswers = (car.correctAnswers || 0) + 1;
          car.combo = (car.combo || 0) + 1;
          const comboBonus = Math.min(10, car.combo);
          car.score = (car.score || 0) + 10 + comboBonus;
        } else {
          car.combo = 0;
          if (Math.random() < 0.3) {
            car.score = Math.max(0, (car.score || 0) - 10);
          }
        }
      }

      // Curve steering compensation
      car.x += -carSegment.curve * 0.015;

      // AI Decision logic when approaching a quiz gate (about 40 segments ahead)
      const segmentsAhead = 40;
      const targetCheckZ = car.z + segmentsAhead * this.segmentLength;
      const aheadSegment = this.findSegment(targetCheckZ);

      const now = performance.now();
      if (aheadSegment.gate && !aheadSegment.gate.triggered) {
        if (now - car.lastDecisionTime > 1200) { // re-evaluate every 1.2s
          // AI makes decision based on accuracy
          const roll = Math.random();
          const shouldPickCorrect = roll < car.accuracy;
          const correctOpt = aheadSegment.gate.question.correctOption;
          
          let aiOption: 'A' | 'B' = correctOpt;
          if (!shouldPickCorrect) {
            aiOption = correctOpt === 'A' ? 'B' : 'A';
          }
          
          // Target -0.5 for A, 0.5 for B
          car.targetX = aiOption === 'A' ? -0.5 : 0.5;
          car.lastDecisionTime = now;
        }
      } else {
        // Normal AI driving: avoid obstacles on road, or steer to draft/overtake player
        const nextSegment = this.findSegment(car.z + 10 * this.segmentLength);
        const obstacle = nextSegment.sprites.find(s => s.type === 'cone' || s.type === 'crate' || s.type === 'barrier');
        
        if (obstacle) {
          // Steer away from obstacle lane
          if (Math.abs(car.x - obstacle.x) < 0.4) {
            car.targetX = obstacle.x > 0 ? -0.5 : 0.5;
          }
        } else if (distDiff > 0 && distDiff < 1500) {
          // Drafting & Slingshot Overtaking logic!
          if (distDiff < 500) {
            // Very close behind player! Slingshot out aggressively to pass
            car.targetX = this.playerX > 0 ? -0.58 : 0.58;
          } else {
            // Stay in the draft stream directly behind player for aerodynamic towing
            car.targetX = this.playerX;
          }
        } else if (distDiff <= 0 && Math.abs(distDiff) < 1200) {
          // AI is slightly ahead. Actively block the player or cut off their path!
          if (Math.sin(performance.now() / 1500) > 0.1) {
            car.targetX = this.playerX; // Defensive block!
          } else {
            car.targetX = this.playerX > 0 ? -0.5 : 0.5; // Slipstream exit
          }
        } else if (now - car.lastDecisionTime > 2000) {
          // Choose a new random driving lane
          car.targetX = (Math.random() - 0.5) * 1.4;
          car.lastDecisionTime = now;
        }
      }

      // Smooth AI steering towards targetX (responsive, frame-rate independent)
      const steeringDelta = car.targetX - car.x;
      const steerSpeed = 0.08 * 60 * dt;
      car.x += Math.sign(steeringDelta) * Math.min(Math.abs(steeringDelta), steerSpeed);
      car.x = Math.max(-0.85, Math.min(0.85, car.x));
    });
  }

  // Collision checks with gates and obstacles
  private checkCollisions(playerSegment: Segment) {
    const playerSegmentIndex = playerSegment.index;

    // Loop a small range around player segment to find any overlap (object thickness)
    const checkRadius = 2;
    for (let offset = -checkRadius; offset <= checkRadius; offset++) {
      const idx = (playerSegmentIndex + offset + this.segmentCount) % this.segmentCount;
      const seg = this.segments[idx];

      // 1. Check QUIZ GATE answers
      if (seg.gate && !seg.gate.triggered) {
        // Player crosses the gate
        const relativeZ = this.playerZ - seg.p1.world.z;
        // Check if player is right on the entry line
        if (relativeZ >= 0 && relativeZ <= this.speed * 2.5) {
          seg.gate.triggered = true;
          
          // Determine chosen gate by selectedAnswer state or fallback to X position
          const chosenOption = useGameStore.getState().selectedAnswer || (this.playerX < 0 ? 'A' : 'B');
          
          const result = this.onAnswer(chosenOption);
          
          // Flash effect
          if (result.isCorrect) {
            this.flashScreen('rgba(16, 185, 129, 0.4)', 0.5); // Green flash
            this.boostTimeRemaining = 3.0; // 答對題目會加速3秒鐘
          } else {
            this.flashScreen('rgba(239, 68, 68, 0.4)', 0.8); // Red flash
            this.cameraShakeIntensity = 6;
            this.slowdownTimeRemaining = 1.0; // 答錯題目減速1秒鐘
            this.boostTimeRemaining = 0; // 取消加速狀態
          }

          // Generate next quiz for future gates
          setTimeout(() => {
            this.replenishGate(seg);
          }, 3000);
        }
      }

      // 2. Check OBSTACLE hits
      seg.sprites.forEach((sprite) => {
        if (sprite.hit) return; // already hit
        
        const isObstacle = sprite.type === 'cone' || sprite.type === 'barrier' || sprite.type === 'crate';
        if (!isObstacle) return;

        const relativeZ = this.playerZ - seg.p1.world.z;
        // Check if player matches sprite Z and X coordinates
        if (relativeZ >= 0 && relativeZ <= this.speed * 2.5) {
          const xOverlap = Math.abs(this.playerX - sprite.x) < 0.35;
          if (xOverlap) {
            sprite.hit = true;
            
            // 計算碰撞時的速度比例，用於動態碰撞音效與震幅
            const hitSpeedPercent = this.speed / this.maxSpeed;
            AudioManager.getInstance().play('crash', { pitch: Math.max(0.15, hitSpeedPercent) });
            
            this.speed = Math.max(0, this.speed * 0.3); // Heavy deceleration
            this.cameraShakeIntensity = 12; // Camera shake!
            this.flashScreen('rgba(239, 68, 68, 0.6)', 0.3);
            this.onObstacleHit();
          }
        }
      });
    }
  }

  // Dynamically replace gate questions to support endless loops
  private replenishGate(seg: Segment) {
    const nextQuestion = this.currentQuestionSupplier();
    if (nextQuestion) {
      seg.gate = {
        question: nextQuestion,
        triggered: false,
        yOffset: 0
      };
    }
  }

  // Trigger flashing screen overlays for feedbacks
  private flashScreen(color: string, duration: number) {
    this.flashColor = color;
    this.flashDuration = duration;
  }

  // Draw 3D scene onto canvas
  private render() {
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Apply Camera Shake offset
    this.ctx.save();
    if (this.cameraShakeIntensity > 0) {
      const shakeX = (Math.random() - 0.5) * this.cameraShakeIntensity * 4;
      const shakeY = (Math.random() - 0.5) * this.cameraShakeIntensity * 4;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. Draw Space Sky & Neon Grid background
    this.drawSky();

    // 2. Projection & drawing setup
    let startPos = Math.floor(this.playerZ / this.segmentLength) % this.segmentCount;
    if (isNaN(startPos)) startPos = 0;
    if (startPos < 0) startPos += this.segmentCount;
    
    let cameraPercent = (this.playerZ % this.segmentLength) / this.segmentLength;
    if (isNaN(cameraPercent)) cameraPercent = 0;
    
    // Smooth camera elevation matching player hill climbs
    const playerSegment = this.findSegment(this.playerZ);
    const interpolatedY = playerSegment.p1.world.y + (playerSegment.p2.world.y - playerSegment.p1.world.y) * cameraPercent;
    const currentCameraHeight = interpolatedY + this.cameraHeight;

    // Mathematically continuous horizontal offsets to eliminate all road snapping and jittering at segment boundaries!
    let xAccumulator = -cameraPercent * playerSegment.curve;

    // Project visible segments in Draw Distance
    for (let n = 0; n < this.drawDistance; n++) {
      let segmentIndex = (startPos + n) % this.segmentCount;
      if (isNaN(segmentIndex) || segmentIndex < 0) segmentIndex = 0;
      const segment = this.segments[segmentIndex];
      if (!segment) continue;
      const looped = segmentIndex < startPos;
      
      const loopDeltaZ = looped ? (this.segmentCount * this.segmentLength) : 0;
      
      const p1Offset = xAccumulator;
      
      this.projectPoint(
        segment.p1,
        this.playerX * this.roadWidth,
        currentCameraHeight,
        this.playerZ - loopDeltaZ, // Perfect loopDeltaZ correction prevents road flashing and gaps at finish line!
        p1Offset,
        0
      );
      
      const p2Offset = p1Offset + segment.curve;
      
      this.projectPoint(
        segment.p2,
        this.playerX * this.roadWidth,
        currentCameraHeight,
        this.playerZ - loopDeltaZ, // Perfect loopDeltaZ correction prevents road flashing and gaps at finish line!
        p2Offset,
        0
      );
      
      // Advance accumulator for next segment's start point
      xAccumulator = p2Offset;
      
      // Store accum for sprite project
      segment.loopCurveSum = p2Offset;
    }

    // 3. Draw Road, Grass, & Rumbles
    const storeState = useGameStore.getState();
    const isCinematicCamera = storeState.isCompleting && this.completionTimeElapsed >= 2.5;

    if (isCinematicCamera) {
      // 3a. Draw road segments back-to-front with occlusion culling
      let maxy = this.height;
      for (let n = this.drawDistance - 1; n > 0; n--) {
        let segmentIndex = (startPos + n) % this.segmentCount;
        if (isNaN(segmentIndex) || segmentIndex < 0) segmentIndex = 0;
        const segment = this.segments[segmentIndex];
        if (!segment) continue;
        
        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;
        
        if (p1.y <= 0 || p2.y <= 0 || p1.y >= p2.y) continue;
        if (p2.y < maxy) {
          this.drawSegment(segment, p1, p2);
          maxy = p2.y;
        }
      }

      // 3b. Collect all 3D objects to sort by depth relative to camera
      interface DrawableObject {
        type: 'ai_car' | 'player_car' | 'gate' | 'finish_line' | 'sprite';
        z: number;
        transZ: number;
        segment: any;
        extra?: any;
      }

      const drawables: DrawableObject[] = [];
      const cinematicT = Math.min(1.0, (this.completionTimeElapsed - 2.5) / 6.0);
      const theta = -0.15 + cinematicT * 0.45;

      // Player Car
      const playerSeg = this.findSegment(this.playerZ);
      const pTransZ = this.getOrbitTransZ(this.playerX * this.roadWidth, playerSeg.p1.world.y, this.playerZ, playerSeg.loopCurveSum);
      drawables.push({
        type: 'player_car',
        z: this.playerZ,
        transZ: pTransZ,
        segment: playerSeg
      });

      // AI Cars
      this.aiCars.forEach(car => {
        const carSeg = this.findSegment(car.z);
        const carTransZ = this.getOrbitTransZ(car.x * this.roadWidth, carSeg.p1.world.y, car.z, carSeg.loopCurveSum);
        drawables.push({
          type: 'ai_car',
          z: car.z,
          transZ: carTransZ,
          segment: carSeg,
          extra: car
        });
      });

      // Gates, Finish Lines, and Sprites within draw range
      for (let n = 0; n < this.drawDistance; n++) {
        let segmentIndex = (startPos + n) % this.segmentCount;
        if (isNaN(segmentIndex) || segmentIndex < 0) segmentIndex = 0;
        const segment = this.segments[segmentIndex];
        if (!segment) continue;

        if (segment.gate) {
          const gTransZ = this.getOrbitTransZ(0, segment.p1.world.y, segment.p1.world.z, segment.loopCurveSum);
          drawables.push({
            type: 'gate',
            z: segment.p1.world.z,
            transZ: gTransZ,
            segment: segment
          });
        }

        if (segment.finishLine) {
          const fTransZ = this.getOrbitTransZ(0, segment.p1.world.y, segment.p1.world.z, segment.loopCurveSum);
          drawables.push({
            type: 'finish_line',
            z: segment.p1.world.z,
            transZ: fTransZ,
            segment: segment
          });
        }

        segment.sprites.forEach(sprite => {
          const sTransZ = this.getOrbitTransZ(sprite.x * this.roadWidth, segment.p1.world.y, segment.p1.world.z, segment.loopCurveSum);
          drawables.push({
            type: 'sprite',
            z: segment.p1.world.z,
            transZ: sTransZ,
            segment: segment,
            extra: sprite
          });
        });
      }

      // Sort descending by transZ (deepest/farthest first)
      drawables.sort((a, b) => b.transZ - a.transZ);

      // Draw all objects back-to-front
      drawables.forEach(obj => {
        if (obj.transZ <= 0) return; // behind camera
        
        if (obj.type === 'player_car') {
          this.drawPlayerCarOutside(theta);
        } else if (obj.type === 'ai_car') {
          this.drawAICar(obj.extra);
        } else if (obj.type === 'gate') {
          this.drawGate(obj.segment);
        } else if (obj.type === 'finish_line') {
          this.drawFinishLine(obj.segment);
        } else if (obj.type === 'sprite') {
          this.drawSprite(obj.segment, obj.extra);
        }
      });
    } else {
      // Normal 3D projection rendering for standard gameplay
      let maxy = this.height;
      for (let n = this.drawDistance - 1; n > 0; n--) {
        let segmentIndex = (startPos + n) % this.segmentCount;
        if (isNaN(segmentIndex) || segmentIndex < 0) segmentIndex = 0;
        const segment = this.segments[segmentIndex];
        if (!segment) continue;
        
        const p1 = segment.p1.screen;
        const p2 = segment.p2.screen;
        
        if (p1.y <= 0 || p2.y <= 0 || p1.y >= p2.y) continue;
        if (p2.y < maxy) {
          this.drawSegment(segment, p1, p2);
          maxy = p2.y;
        }
      }

      // Draw Gates, Sprites (decor/obstacles) and AI Cars back-to-front
      for (let n = this.drawDistance - 1; n >= 0; n--) {
        let segmentIndex = (startPos + n) % this.segmentCount;
        if (isNaN(segmentIndex) || segmentIndex < 0) segmentIndex = 0;
        const segment = this.segments[segmentIndex];
        if (!segment) continue;

        if (segment.gate) {
          this.drawGate(segment);
        }

        if (segment.finishLine) {
          this.drawFinishLine(segment);
        }

        segment.sprites.forEach((sprite) => {
          this.drawSprite(segment, sprite);
        });

        this.aiCars.forEach((car) => {
          const carSegIndex = Math.floor(car.z / this.segmentLength) % this.segmentCount;
          if (carSegIndex === segmentIndex) {
            this.drawAICar(car);
          }
        });
      }

      // Draw Cockpit / Dash HUD (First-Person View)
      this.drawPlayerCockpit();

      // Draw Rear-View Mirror (Show trailing AI Cars)
      this.drawRearViewMirror();
    }

    // 6. Draw Flash Effects (e.g., Red on Hit, Green on correct answer)
    if (this.flashColor) {
      this.ctx.fillStyle = this.flashColor;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    this.ctx.restore();
  }

  // Draw space sky & distant stars
  private drawSky() {
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.height / 2);
    skyGrad.addColorStop(0, '#0a0a1a'); // Deep dark cosmic sky
    skyGrad.addColorStop(0.5, '#1a1a3a'); // Mid atmospheric blue/purple
    skyGrad.addColorStop(1, '#2a2a4a'); // Deep indigo sunset line
    
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw grid mesh perspective horizon
    this.ctx.strokeStyle = 'rgba(255, 204, 0, 0.1)'; // soft gold lines
    this.ctx.lineWidth = 1;
    const horizon = this.height / 2;
    
    // Drawing a sunset glow
    const radial = this.ctx.createRadialGradient(
      this.width / 2 - (this.skyOffset * this.width * 0.1), horizon, 10,
      this.width / 2 - (this.skyOffset * this.width * 0.1), horizon, this.width * 0.4
    );
    radial.addColorStop(0, 'rgba(255, 51, 102, 0.25)'); // Elegant pink/magenta sun glow
    radial.addColorStop(1, 'rgba(255, 51, 102, 0)');
    this.ctx.fillStyle = radial;
    this.ctx.beginPath();
    this.ctx.arc(this.width / 2 - (this.skyOffset * this.width * 0.1), horizon, this.width * 0.4, Math.PI, 0, false);
    this.ctx.fill();

    // Star decorations
    this.ctx.fillStyle = '#ffffff';
    for (let s = 0; s < 30; s++) {
      const sx = (Math.sin(s * 423.4) * 0.5 + 0.5) * this.width;
      const sy = (Math.cos(s * 782.12) * 0.5 + 0.5) * horizon * 0.9;
      const size = (Math.sin(s + this.skyOffset * 10) * 0.5 + 0.5) * 1.5 + 0.5;
      this.ctx.fillRect(sx, sy, size, size);
    }
  }

  // Draws actual road polygons
  private drawSegment(seg: Segment, p1: { x: number; y: number; w: number }, p2: { x: number; y: number; w: number }) {
    // Grass
    this.ctx.fillStyle = seg.color.grass;
    this.ctx.fillRect(0, p2.y, this.width, p1.y - p2.y);
    
    // Elevated 3D Curbstones (路緣石) with alternating Red and White blocks (increased width and height for high clarity)
    const curbW1 = p1.w * 0.12;
    const curbW2 = p2.w * 0.12;
    const curbHeight1 = p1.w * 0.035;
    const curbHeight2 = p2.w * 0.035;

    const isEvenCurb = Math.floor(seg.index / 3) % 2 === 0;
    const curbColor = isEvenCurb ? '#ff1e56' : '#ffffff'; // Neon red and pure white
    const innerFaceColor = isEvenCurb ? '#c00a34' : '#e2e8f0'; // Shaded darker side
    const outerFaceColor = isEvenCurb ? '#80001d' : '#cbd5e1'; // Outer darkest side
    
    // LEFT CURBSTONE
    // 1. Top surface
    this.drawPolygon(
      p1.x - p1.w - curbW1, p1.y - curbHeight1,
      p1.x - p1.w, p1.y - curbHeight1,
      p2.x - p2.w, p2.y - curbHeight2,
      p2.x - p2.w - curbW2, p2.y - curbHeight2,
      curbColor
    );
    // 2. Inner vertical face (facing the road)
    this.drawPolygon(
      p1.x - p1.w, p1.y - curbHeight1,
      p1.x - p1.w, p1.y,
      p2.x - p2.w, p2.y,
      p2.x - p2.w, p2.y - curbHeight2,
      innerFaceColor
    );
    // 3. Outer vertical face (facing the grass)
    this.drawPolygon(
      p1.x - p1.w - curbW1, p1.y,
      p1.x - p1.w - curbW1, p1.y - curbHeight1,
      p2.x - p2.w - curbW2, p2.y - curbHeight2,
      p2.x - p2.w - curbW2, p2.y,
      outerFaceColor
    );

    // RIGHT CURBSTONE
    // 1. Top surface
    this.drawPolygon(
      p1.x + p1.w, p1.y - curbHeight1,
      p1.x + p1.w + curbW1, p1.y - curbHeight1,
      p2.x + p2.w + curbW2, p2.y - curbHeight2,
      p2.x + p2.w, p2.y - curbHeight2,
      curbColor
    );
    // 2. Inner vertical face (facing the road)
    this.drawPolygon(
      p1.x + p1.w, p1.y,
      p1.x + p1.w, p1.y - curbHeight1,
      p2.x + p2.w, p2.y - curbHeight2,
      p2.x + p2.w, p2.y,
      innerFaceColor
    );
    // 3. Outer vertical face (facing the grass)
    this.drawPolygon(
      p1.x + p1.w + curbW1, p1.y - curbHeight1,
      p1.x + p1.w + curbW1, p1.y,
      p2.x + p2.w + curbW2, p2.y,
      p2.x + p2.w + curbW2, p2.y - curbHeight2,
      outerFaceColor
    );
    
    // Main Road
    this.drawPolygon(
      p1.x - p1.w, p1.y,
      p1.x + p1.w, p1.y,
      p2.x + p2.w, p2.y,
      p2.x - p2.w, p2.y,
      seg.color.road
    );

    // Left and Right High-Contrast Road Edge lines (亮黃色警示邊線 - 增加寬度)
    const roadEdgeW1 = p1.w * 0.045;
    const roadEdgeW2 = p2.w * 0.045;
    const roadEdgeOffset1 = p1.w * 0.015;
    const roadEdgeOffset2 = p2.w * 0.015;

    // Left Yellow Edge Line
    this.drawPolygon(
      p1.x - p1.w + roadEdgeOffset1, p1.y,
      p1.x - p1.w + roadEdgeOffset1 + roadEdgeW1, p1.y,
      p2.x - p2.w + roadEdgeOffset2 + roadEdgeW2, p2.y,
      p2.x - p2.w + roadEdgeOffset2, p2.y,
      '#FFCC00'
    );

    // Right Yellow Edge Line
    this.drawPolygon(
      p1.x + p1.w - roadEdgeOffset1 - roadEdgeW1, p1.y,
      p1.x + p1.w - roadEdgeOffset1, p1.y,
      p2.x + p2.w - roadEdgeOffset2, p2.y,
      p2.x + p2.w - roadEdgeOffset2 - roadEdgeW2, p2.y,
      '#FFCC00'
    );

    // Continuous Neon Guardrails / Barrier Walls on outer side of both curbstones
    const barrierH1 = p1.w * 0.06;
    const barrierH2 = p2.w * 0.06;
    const railW1 = p1.w * 0.015;
    const railW2 = p2.w * 0.015;

    // LEFT CONTINUOUS BARRIER WALL (Glowing Cyan barrier)
    this.drawPolygon(
      p1.x - p1.w - curbW1, p1.y - curbHeight1,
      p1.x - p1.w - curbW1, p1.y - curbHeight1 - barrierH1,
      p2.x - p2.w - curbW2, p2.y - curbHeight2 - barrierH2,
      p2.x - p2.w - curbW2, p2.y - curbHeight2,
      isEvenCurb ? 'rgba(0, 243, 255, 0.45)' : 'rgba(0, 243, 255, 0.2)'
    );
    // Left glowing top handrail tube
    this.drawPolygon(
      p1.x - p1.w - curbW1 - railW1 / 2, p1.y - curbHeight1 - barrierH1,
      p1.x - p1.w - curbW1 + railW1 / 2, p1.y - curbHeight1 - barrierH1,
      p2.x - p2.w - curbW2 + railW2 / 2, p2.y - curbHeight2 - barrierH2,
      p2.x - p2.w - curbW2 - railW2 / 2, p2.y - curbHeight2 - barrierH2,
      '#00f3ff'
    );
    // Left glowing inner white core
    this.drawPolygon(
      p1.x - p1.w - curbW1 - railW1 * 0.15, p1.y - curbHeight1 - barrierH1,
      p1.x - p1.w - curbW1 + railW1 * 0.15, p1.y - curbHeight1 - barrierH1,
      p2.x - p2.w - curbW2 + railW2 * 0.15, p2.y - curbHeight2 - barrierH2,
      p2.x - p2.w - curbW2 - railW2 * 0.15, p2.y - curbHeight2 - barrierH2,
      '#ffffff'
    );

    // RIGHT CONTINUOUS BARRIER WALL (Glowing Pink/Magenta barrier)
    this.drawPolygon(
      p1.x + p1.w + curbW1, p1.y - curbHeight1,
      p1.x + p1.w + curbW1, p1.y - curbHeight1 - barrierH1,
      p2.x + p2.w + curbW2, p2.y - curbHeight2 - barrierH2,
      p2.x + p2.w + curbW2, p2.y - curbHeight2,
      isEvenCurb ? 'rgba(255, 0, 127, 0.45)' : 'rgba(255, 0, 127, 0.2)'
    );
    // Right glowing top handrail tube
    this.drawPolygon(
      p1.x + p1.w + curbW1 - railW1 / 2, p1.y - curbHeight1 - barrierH1,
      p1.x + p1.w + curbW1 + railW1 / 2, p1.y - curbHeight1 - barrierH1,
      p2.x + p2.w + curbW2 + railW2 / 2, p2.y - curbHeight2 - barrierH2,
      p2.x + p2.w + curbW2 - railW2 / 2, p2.y - curbHeight2 - barrierH2,
      '#ff007f'
    );
    // Right glowing inner white core
    this.drawPolygon(
      p1.x + p1.w + curbW1 - railW1 * 0.15, p1.y - curbHeight1 - barrierH1,
      p1.x + p1.w + curbW1 + railW1 * 0.15, p1.y - curbHeight1 - barrierH1,
      p2.x + p2.w + curbW2 + railW2 * 0.15, p2.y - curbHeight2 - barrierH2,
      p2.x + p2.w + curbW2 - railW2 * 0.15, p2.y - curbHeight2 - barrierH2,
      '#ffffff'
    );

    // Left and Right High-contrast Neon Edges with White Core (glowing neon tubes) riding along the top edge of curbstones
    const edgeWidth1 = p1.w * 0.035;
    const edgeWidth2 = p2.w * 0.035;
    const coreWidth1 = p1.w * 0.012;
    const coreWidth2 = p2.w * 0.012;

    // Left border (Bright Neon Cyan Base)
    this.drawPolygon(
      p1.x - p1.w - edgeWidth1 / 2, p1.y - curbHeight1,
      p1.x - p1.w + edgeWidth1 / 2, p1.y - curbHeight1,
      p2.x - p2.w + edgeWidth2 / 2, p2.y - curbHeight2,
      p2.x - p2.w - edgeWidth2 / 2, p2.y - curbHeight2,
      '#00ffcc'
    );
    // Left border core (White Glowing effect)
    this.drawPolygon(
      p1.x - p1.w - coreWidth1 / 2, p1.y - curbHeight1,
      p1.x - p1.w + coreWidth1 / 2, p1.y - curbHeight1,
      p2.x - p2.w + coreWidth2 / 2, p2.y - curbHeight2,
      p2.x - p2.w - coreWidth2 / 2, p2.y - curbHeight2,
      '#ffffff'
    );

    // Right border (Bright Neon Pink Base)
    this.drawPolygon(
      p1.x + p1.w - edgeWidth1 / 2, p1.y - curbHeight1,
      p1.x + p1.w + edgeWidth1 / 2, p1.y - curbHeight1,
      p2.x + p2.w + edgeWidth2 / 2, p2.y - curbHeight2,
      p2.x + p2.w - edgeWidth2 / 2, p2.y - curbHeight2,
      '#ff007f'
    );
    // Right border core (White Glowing effect)
    this.drawPolygon(
      p1.x + p1.w - coreWidth1 / 2, p1.y - curbHeight1,
      p1.x + p1.w + coreWidth1 / 2, p1.y - curbHeight1,
      p2.x + p2.w + coreWidth2 / 2, p2.y - curbHeight2,
      p2.x + p2.w - coreWidth2 / 2, p2.y - curbHeight2,
      '#ffffff'
    );

    // 3D Delineator / Guide Warning Posts on both sides (每 4 個 segment 繪製一對，強化視覺引導效果)
    if (seg.index % 4 === 0) {
      const postH1 = p1.w * 0.16;
      const postH2 = p2.w * 0.16;
      const postW1 = p1.w * 0.016;
      const postW2 = p2.w * 0.016;
      
      const isEvenPost = Math.floor(seg.index / 8) % 2 === 0;
      const lightColor = isEvenPost ? '#ff3366' : '#00ffcc'; // Alternate flashing colors
      
      // LEFT POST (左側警示柱)
      const lx1 = p1.x - p1.w - curbW1 - postW1 / 2;
      const lx2 = p2.x - p2.w - curbW2 - postW2 / 2;
      const ly1 = p1.y - curbHeight1;
      const ly2 = p2.y - curbHeight2;

      // Draw pole base body (yellow back, striped black)
      this.drawPolygon(
        lx1, ly1,
        lx1 + postW1, ly1,
        lx2 + postW2, ly2,
        lx2, ly2,
        '#eab308'
      );

      // Stripes on Left Pole
      for (let i = 1; i <= 3; i++) {
        const py1 = ly1 - (postH1 * 0.25 * i);
        const py2 = ly2 - (postH2 * 0.25 * i);
        const py1_next = ly1 - (postH1 * 0.25 * (i + 0.4));
        const py2_next = ly2 - (postH2 * 0.25 * (i + 0.4));
        this.drawPolygon(
          lx1, py1,
          lx1 + postW1, py1,
          lx2 + postW2, py2_next,
          lx2, py2_next,
          '#1e293b' // black stripes
        );
      }

      // Left Reflector Light Cap
      const topR1 = postW1 * 1.5;
      const topY1 = ly1 - postH1;
      if (topR1 > 1.2) {
        this.ctx.fillStyle = lightColor;
        this.ctx.beginPath();
        this.ctx.arc(lx1 + postW1 / 2, topY1, topR1, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(lx1 + postW1 / 2, topY1, topR1 * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // RIGHT POST (右側警示柱)
      const rx1 = p1.x + p1.w + curbW1 - postW1 / 2;
      const rx2 = p2.x + p2.w + curbW2 - postW2 / 2;
      const ry1 = p1.y - curbHeight1;
      const ry2 = p2.y - curbHeight2;

      // Draw pole base body
      this.drawPolygon(
        rx1, ry1,
        rx1 + postW1, ry1,
        rx2 + postW2, ry2,
        rx2, ry2,
        '#eab308'
      );

      // Stripes on Right Pole
      for (let i = 1; i <= 3; i++) {
        const py1 = ry1 - (postH1 * 0.25 * i);
        const py2 = ry2 - (postH2 * 0.25 * i);
        const py1_next = ry1 - (postH1 * 0.25 * (i + 0.4));
        const py2_next = ry2 - (postH2 * 0.25 * (i + 0.4));
        this.drawPolygon(
          rx1, py1,
          rx1 + postW1, py1,
          rx2 + postW2, py2_next,
          rx2, py2_next,
          '#1e293b'
        );
      }

      // Right Reflector Light Cap
      const topY2 = ry1 - postH1;
      if (topR1 > 1.2) {
        this.ctx.fillStyle = lightColor;
        this.ctx.beginPath();
        this.ctx.arc(rx1 + postW1 / 2, topY2, topR1, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(rx1 + postW1 / 2, topY2, topR1 * 0.4, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
    
    // Center Lane Dividers (with added high-contrast cores)
    if (seg.color.lane) {
      const laneWidth1 = p1.w * 0.035;
      const laneWidth2 = p2.w * 0.035;
      const innerLaneWidth1 = p1.w * 0.012;
      const innerLaneWidth2 = p2.w * 0.012;
      
      // Draw 2 white divider lines on the 3-lane road
      for (let l = 1; l < this.lanes; l++) {
        // Offset ratio
        const lOffset = -1.0 + (2.0 / this.lanes) * l;
        this.drawPolygon(
          p1.x + p1.w * lOffset - laneWidth1 / 2, p1.y,
          p1.x + p1.w * lOffset + laneWidth1 / 2, p1.y,
          p2.x + p2.w * lOffset + laneWidth2 / 2, p2.y,
          p2.x + p2.w * lOffset - laneWidth2 / 2, p2.y,
          seg.color.lane
        );

        // If it's a solid/bright lane line, draw a white core to make it pop!
        if (!seg.color.lane.includes('rgba')) {
          this.drawPolygon(
            p1.x + p1.w * lOffset - innerLaneWidth1 / 2, p1.y,
            p1.x + p1.w * lOffset + innerLaneWidth1 / 2, p1.y,
            p2.x + p2.w * lOffset + innerLaneWidth2 / 2, p2.y,
            p2.x + p2.w * lOffset - innerLaneWidth2 / 2, p2.y,
            '#ffffff'
          );
        }
      }
    }
  }

  // Draw polygon utility
  private drawPolygon(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.lineTo(x3, y3);
    this.ctx.lineTo(x4, y4);
    this.ctx.closePath();
    this.ctx.fill();
  }

  // Draw interactive quiz gates
  private drawGate(seg: Segment) {
    if (!seg.gate) return;
    
    const p1 = seg.p1.screen;
    const gateY = p1.y;
    const gateW = p1.w;
    
    if (gateY <= 0 || gateW <= 0) return;

    // Floating animation
    const floatOffset = Math.sin(performance.now() / 200) * 15;
    
    // Gate arch columns (Left & Right) - Elevated and taller to act like highway gantries
    const archH = gateW * 1.5; // Taller arch pillars (was 0.8)
    
    // Draw Left and Right supporting cyber-pillars
    const pillW = gateW * 0.08;
    this.ctx.fillStyle = '#111111'; // Darker sleek pillars
    this.ctx.strokeStyle = '#FFCC00'; // Glowing gold trim
    this.ctx.lineWidth = Math.max(1, gateW * 0.015);
    
    // Left Column
    this.ctx.beginPath();
    this.ctx.rect(p1.x - gateW - pillW/2, gateY - archH, pillW, archH);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Right Column
    this.ctx.beginPath();
    this.ctx.rect(p1.x + gateW - pillW/2, gateY - archH, pillW, archH);
    this.ctx.fill();
    this.ctx.stroke();

    // Arch Overhead Crossbar
    this.ctx.fillStyle = '#1e1e1e';
    this.ctx.beginPath();
    this.ctx.rect(p1.x - gateW - pillW/2, gateY - archH - pillW, gateW * 2 + pillW, pillW);
    this.ctx.fill();
    this.ctx.stroke();

    // Left gate (Option A) & Right gate (Option B) boxes
    // Hovering overhead with plenty of clearance under them for a clean racing look.
    const doorW = gateW * 0.65;
    const doorH = archH * 0.45; // elevated panel height
    
    // Float doors overhead
    const doorY = gateY - archH + floatOffset * 0.1; // hanging from the top crossbar with subtle float
    
    // Option A Panel (Neon Emerald Green)
    const doorAX = p1.x - gateW / 2 - doorW / 2;
    
    // Option B Panel (Neon Hot Pink)
    const doorBX = p1.x + gateW / 2 - doorW / 2;

    this.drawQuizDoor(
      doorAX, doorY, doorW, doorH, 
      'A', seg.gate.question.options.A, 
      '#00FF88', 'rgba(0, 255, 136, 0.1)', 
      seg.gate.triggered
    );

    this.drawQuizDoor(
      doorBX, doorY, doorW, doorH, 
      'B', seg.gate.question.options.B, 
      '#FF3366', 'rgba(255, 51, 102, 0.1)', 
      seg.gate.triggered
    );
  }

  // Helper to draw left/right quiz entry choices
  private drawQuizDoor(
    dx: number, dy: number, dw: number, dh: number, 
    label: string, text: string, 
    color: string, bg: string, triggered: boolean
  ) {
    if (triggered) {
      color = 'rgba(148, 163, 184, 0.5)'; // greyed out
      bg = 'rgba(148, 163, 184, 0.03)';
    }

    // Glowing Neon Door arch
    this.ctx.fillStyle = bg;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = Math.max(1.5, dw * 0.03);
    this.ctx.beginPath();
    this.ctx.roundRect(dx, dy, dw, dh, 8);
    this.ctx.fill();
    this.ctx.stroke();

    // Option Box Header (Circle with letter A or B)
    const radius = Math.max(15, dw * 0.18);
    const circleX = dx + dw / 2;
    const circleY = dy + dh / 2;
    
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(circleX, circleY, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Text: A or B
    this.ctx.font = `bold ${Math.round(radius * 1.2)}px "Inter", sans-serif`;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(label, circleX, circleY);
  }

  // Draw a majestic checkered neon/laser finish line arch across the road
  private drawFinishLine(seg: Segment) {
    const p1 = seg.p1.screen;
    const gateY = p1.y;
    const gateW = p1.w;
    
    if (gateY <= 0 || gateW <= 0) return;

    // Arch height scales with screen width
    const archH = gateW * 1.6;
    const pillW = gateW * 0.1;

    // Left and Right pillars
    this.ctx.fillStyle = '#1e293b';
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.lineWidth = Math.max(1.5, gateW * 0.015);

    // Left Pillar
    this.ctx.fillRect(p1.x - gateW * 1.5 - pillW, gateY - archH, pillW, archH);
    this.ctx.strokeRect(p1.x - gateW * 1.5 - pillW, gateY - archH, pillW, archH);

    // Right Pillar
    this.ctx.fillRect(p1.x + gateW * 1.5, gateY - archH, pillW, archH);
    this.ctx.strokeRect(p1.x + gateW * 1.5, gateY - archH, pillW, archH);

    // Top Crossbar (Checkered pattern)
    const barY = gateY - archH;
    const barH = archH * 0.25;
    const barW = gateW * 3.0 + pillW * 2;
    const barX = p1.x - gateW * 1.5 - pillW;

    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(barX, barY, barW, barH);
    this.ctx.strokeRect(barX, barY, barW, barH);

    // Checkered patterns inside the top bar
    const checkSize = barH / 2;
    const numChecks = Math.floor(barW / checkSize);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < numChecks; col++) {
        if ((row + col) % 2 === 0) {
          this.ctx.fillStyle = '#ffffff';
        } else {
          this.ctx.fillStyle = '#000000';
        }
        this.ctx.fillRect(barX + col * checkSize, barY + row * checkSize, checkSize, checkSize);
      }
    }

    // Glowing Banner Text "🏁 FINISH 🏁"
    this.ctx.save();
    const fontSize = Math.max(10, Math.round(barH * 0.6));
    this.ctx.font = `italic bold ${fontSize}px "Space Grotesk", "Inter", sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Cyan neon glow behind text
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = Math.max(4, barH * 0.15);
    
    this.ctx.fillStyle = '#00ffff';
    this.ctx.fillText("🏁 FINISH LINE 🏁", p1.x, barY + barH / 2);
    this.ctx.restore();

    // Laser curtain hanging down from crossbar
    const gradient = this.ctx.createLinearGradient(0, barY + barH, 0, gateY);
    gradient.addColorStop(0, 'rgba(0, 255, 136, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 255, 136, 0.0)');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(barX, barY + barH, barW, gateY - (barY + barH));
  }

  // Canvas utility to auto wrap text
  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const char = words[i];
      const testLine = currentLine + char;
      const metrics = this.ctx.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && i > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);
    return lines.slice(0, 3); // cap at 3 lines
  }

  // Draw trees, obstacles, billboards
  private drawSprite(seg: Segment, sprite: SpriteInstance) {
    const p1 = seg.p1.screen;
    if (p1.y <= 0) return;

    // Calculate screen position
    const spriteX = p1.x + (seg.loopCurveSum * p1.w * 0.0001) + (sprite.x * p1.w);
    const spriteY = p1.y;
    const scale = (p1.w / this.roadWidth) * sprite.scale;
    
    const w = sprite.width * scale;
    const h = sprite.width * scale * 1.2; // roughly taller than wide

    if (sprite.hit) {
      // Draw knocked down / smashed obstacle
      this.ctx.save();
      this.ctx.translate(spriteX, spriteY);
      this.ctx.rotate(Math.PI / 2); // fallen over
      this.drawVectorSprite(sprite.type, -w/2, -h, w, h, true);
      this.ctx.restore();
    } else {
      this.drawVectorSprite(sprite.type, spriteX - w/2, spriteY - h, w, h, false, sprite.text);
    }
  }

  // Draw high-quality custom vector shapes for sprites
  private drawVectorSprite(type: string, x: number, y: number, w: number, h: number, isHit: boolean, text?: string) {
    this.ctx.save();
    
    if (type === 'tree') {
      // Futuristic cyber neon tree
      const stemW = w * 0.15;
      this.ctx.fillStyle = '#1e293b'; // trunk
      this.ctx.strokeStyle = '#6366f1'; // trunk glowing line
      this.ctx.lineWidth = Math.max(1, w * 0.03);
      this.ctx.beginPath();
      this.ctx.rect(x + w/2 - stemW/2, y + h * 0.6, stemW, h * 0.4);
      this.ctx.fill();
      this.ctx.stroke();

      // Glowing leaves (Polygon)
      this.ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      this.ctx.strokeStyle = '#818cf8';
      this.ctx.lineWidth = Math.max(2, w * 0.05);
      
      this.ctx.beginPath();
      this.ctx.moveTo(x + w/2, y);
      this.ctx.lineTo(x + w, y + h * 0.6);
      this.ctx.lineTo(x, y + h * 0.6);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Tech internal nodes
      this.ctx.fillStyle = '#6366f1';
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h*0.3, Math.max(2, w*0.06), 0, Math.PI*2);
      this.ctx.fill();

    } else if (type === 'tree_pink') {
      // Pink glowing sakura cyberpunk tree
      const stemW = w * 0.12;
      this.ctx.fillStyle = '#1e1b4b'; // dark indigo trunk
      this.ctx.strokeStyle = '#ec4899'; // pink neon glowing trunk line
      this.ctx.lineWidth = Math.max(1, w * 0.02);
      this.ctx.beginPath();
      this.ctx.rect(x + w/2 - stemW/2, y + h * 0.5, stemW, h * 0.5);
      this.ctx.fill();
      this.ctx.stroke();

      // Layered pink glowing canopies
      this.ctx.fillStyle = 'rgba(236, 72, 153, 0.2)';
      this.ctx.strokeStyle = '#f472b6';
      this.ctx.lineWidth = Math.max(1.5, w * 0.04);
      
      // Bottom canopy circle
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h * 0.45, w * 0.45, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Middle canopy circle
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h * 0.25, w * 0.35, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Top canopy circle
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h * 0.1, w * 0.22, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Center glowing flower buds
      this.ctx.fillStyle = '#fdf2f8';
      this.ctx.beginPath();
      this.ctx.arc(x + w/2 - w * 0.1, y + h * 0.35, Math.max(1.5, w * 0.04), 0, Math.PI * 2);
      this.ctx.arc(x + w/2 + w * 0.1, y + h * 0.25, Math.max(1.5, w * 0.04), 0, Math.PI * 2);
      this.ctx.arc(x + w/2, y + h * 0.15, Math.max(1.5, w * 0.04), 0, Math.PI * 2);
      this.ctx.fill();

    } else if (type === 'building') {
      // Cyberpunk Skyscraper
      this.ctx.save();
      
      // 1. Shadow background or body silhouette
      this.ctx.fillStyle = '#090d16';
      this.ctx.strokeStyle = '#38bdf8'; // glowing cyan borders
      this.ctx.lineWidth = Math.max(1.5, w * 0.02);
      this.ctx.beginPath();
      this.ctx.rect(x + w * 0.15, y, w * 0.7, h);
      this.ctx.fill();
      this.ctx.stroke();

      // 2. Vertical Edge Accent Line
      this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      this.ctx.lineWidth = Math.max(1, w * 0.01);
      this.ctx.beginPath();
      this.ctx.moveTo(x + w * 0.25, y);
      this.ctx.lineTo(x + w * 0.25, y + h);
      this.ctx.moveTo(x + w * 0.75, y);
      this.ctx.lineTo(x + w * 0.75, y + h);
      this.ctx.stroke();

      // 3. Glowing Window Grids
      const rows = 6;
      const cols = 4;
      const startWinY = h * 0.15;
      const endWinY = h * 0.85;
      const winSpaceY = (endWinY - startWinY) / rows;
      const startWinX = w * 0.22;
      const endWinX = w * 0.68;
      const winSpaceX = (endWinX - startWinX) / cols;
      const winW = winSpaceX * 0.6;
      const winH = winSpaceY * 0.55;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // Semi-randomize window glow states for realism
          const rand = Math.sin(r * 12.3 + c * 45.6 + x * 0.1) > -0.2;
          if (rand) {
            // Alternating colors (cyan / yellow)
            this.ctx.fillStyle = (r + c) % 2 === 0 ? '#06b6d4' : '#eab308';
            this.ctx.fillRect(
              x + startWinX + c * winSpaceX,
              y + startWinY + r * winSpaceY,
              winW,
              winH
            );
          }
        }
      }

      // 4. Roof Antennas & Pulse Beacons
      this.ctx.strokeStyle = '#475569';
      this.ctx.lineWidth = Math.max(1, w * 0.02);
      this.ctx.beginPath();
      this.ctx.moveTo(x + w * 0.5, y);
      this.ctx.lineTo(x + w * 0.5, y - h * 0.2); // Main Antenna
      this.ctx.moveTo(x + w * 0.35, y);
      this.ctx.lineTo(x + w * 0.35, y - h * 0.08); // Side Antenna
      this.ctx.stroke();

      // Pulse beacon glow at top of antenna
      this.ctx.fillStyle = '#ef4444';
      this.ctx.shadowColor = '#ef4444';
      this.ctx.shadowBlur = Math.max(4, w * 0.1);
      this.ctx.beginPath();
      this.ctx.arc(x + w * 0.5, y - h * 0.2, Math.max(1.5, w * 0.03), 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();

    } else if (type === 'house') {
      // Neon Cyber House / Residential Pod
      this.ctx.save();
      
      // Shadow / base background
      this.ctx.fillStyle = '#0f111a';
      this.ctx.strokeStyle = '#22c55e'; // neon green glow
      this.ctx.lineWidth = Math.max(1.5, w * 0.025);
      
      // Draw main house body (Square)
      const bodyY = y + h * 0.35;
      const bodyH = h * 0.65;
      this.ctx.beginPath();
      this.ctx.rect(x + w * 0.1, bodyY, w * 0.8, bodyH);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw pitched glowing roof (Triangle)
      this.ctx.fillStyle = '#1e1b4b'; // glowing indigo roof fill
      this.ctx.strokeStyle = '#10b981'; // bright green outline
      this.ctx.lineWidth = Math.max(2, w * 0.04);
      this.ctx.beginPath();
      this.ctx.moveTo(x + w * 0.5, y); // roof peak
      this.ctx.lineTo(x + w * 0.95, bodyY);
      this.ctx.lineTo(x + w * 0.05, bodyY);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Warm glowing windows (circles/rectangles)
      this.ctx.fillStyle = '#f59e0b'; // amber light
      this.ctx.shadowColor = '#f59e0b';
      this.ctx.shadowBlur = Math.max(3, w * 0.06);

      // Window 1
      this.ctx.fillRect(x + w * 0.22, bodyY + h * 0.15, w * 0.18, h * 0.18);
      // Window 2
      this.ctx.fillRect(x + w * 0.6, bodyY + h * 0.15, w * 0.18, h * 0.18);

      // Cyber door
      this.ctx.fillStyle = '#3b82f6'; // glowing blue door
      this.ctx.shadowColor = '#3b82f6';
      this.ctx.fillRect(x + w * 0.43, bodyY + h * 0.35, w * 0.14, h * 0.3);

      this.ctx.restore();

    } else if (type === 'cone') {
      // Traffic Cone
      // Orange cone body with white reflective tape
      this.ctx.fillStyle = '#0f172a'; // shadow base
      this.ctx.fillRect(x + w*0.05, y + h*0.85, w*0.9, h*0.15);

      // Body (Orange cone)
      this.ctx.fillStyle = '#f97316'; // Orange-500
      this.ctx.beginPath();
      this.ctx.moveTo(x + w/2, y);
      this.ctx.lineTo(x + w * 0.85, y + h * 0.9);
      this.ctx.lineTo(x + w * 0.15, y + h * 0.9);
      this.ctx.closePath();
      this.ctx.fill();

      // White stripe
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.moveTo(x + w * 0.38, y + h * 0.35);
      this.ctx.lineTo(x + w * 0.62, y + h * 0.35);
      this.ctx.lineTo(x + w * 0.72, y + h * 0.65);
      this.ctx.lineTo(x + w * 0.28, y + h * 0.65);
      this.ctx.closePath();
      this.ctx.fill();

      // Reflective glow
      if (!isHit) {
        this.ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
        this.ctx.lineWidth = Math.max(1, w * 0.05);
        this.ctx.stroke();
      }

    } else if (type === 'crate') {
      // Wooden box obstacle
      this.ctx.fillStyle = '#b45309'; // brown
      this.ctx.fillRect(x, y, w, h);
      
      // Box frame
      this.ctx.strokeStyle = '#78350f';
      this.ctx.lineWidth = Math.max(2, w*0.08);
      this.ctx.strokeRect(x, y, w, h);

      // Diagonal cross
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + w, y + h);
      this.ctx.moveTo(x + w, y);
      this.ctx.lineTo(x, y + h);
      this.ctx.stroke();

    } else if (type === 'barrier') {
      // Yellow and Black strip road barrier
      const frameH = h * 0.25;
      
      // Stand legs
      this.ctx.strokeStyle = '#334155';
      this.ctx.lineWidth = Math.max(2, w * 0.07);
      this.ctx.beginPath();
      this.ctx.moveTo(x + w*0.15, y + h);
      this.ctx.lineTo(x + w*0.25, y + frameH);
      this.ctx.moveTo(x + w*0.85, y + h);
      this.ctx.lineTo(x + w*0.75, y + frameH);
      this.ctx.stroke();

      // Barrier main plank
      this.ctx.fillStyle = '#eab308'; // Yellow-500
      this.ctx.fillRect(x, y + frameH, w, h * 0.5);

      // Black hazard stripes
      this.ctx.fillStyle = '#1e293b'; // Slate-800
      const stripeW = w * 0.12;
      for (let s = 0; s < w; s += stripeW * 2) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + s, y + frameH);
        this.ctx.lineTo(x + s + stripeW, y + frameH);
        this.ctx.lineTo(x + s + stripeW * 1.5, y + frameH + h * 0.5);
        this.ctx.lineTo(x + s + stripeW * 0.5, y + frameH + h * 0.5);
        this.ctx.closePath();
        this.ctx.fill();
      }

    } else if (type === 'tax_info_board') {
      // Neon highway advertisement billboard (tax tips)
      const poleW = w * 0.08;
      
      // Supporting pole
      this.ctx.fillStyle = '#334155';
      this.ctx.fillRect(x + w/2 - poleW/2, y + h*0.5, poleW, h*0.5);
      
      // Glowing neon board
      const signH = h * 0.55;
      this.ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      this.ctx.strokeStyle = '#10b981'; // Emerald-500 glow
      this.ctx.lineWidth = Math.max(3, w * 0.02);
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, w, signH, 10);
      this.ctx.fill();
      this.ctx.stroke();

      // Neon LED Dot
      this.ctx.fillStyle = '#10b981';
      this.ctx.beginPath();
      this.ctx.arc(x + 15, y + 15, Math.max(2, w*0.02), 0, Math.PI*2);
      this.ctx.fill();

      // Slogan Text (Taiwan tax tips)
      if (text) {
        const textFontSize = Math.max(8, Math.round(w * 0.055));
        this.ctx.font = `bold ${textFontSize}px "Inter", sans-serif`;
        this.ctx.fillStyle = '#e2e8f0';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Wrap billboard text
        const midY = y + signH / 2;
        const lines = this.wrapText(text, w * 0.88);
        const lineSpacing = textFontSize * 1.35;
        let startY = midY - ((lines.length - 1) * lineSpacing) / 2;
        
        lines.forEach((line) => {
          this.ctx.fillText(line, x + w / 2, startY);
          startY += lineSpacing;
        });
      }
    } else if (type === 'gift') {
      // Draw a beautiful glowing gold/yellow and crimson neon gift box
      const ribbonW = w * 0.22;
      
      this.ctx.save();
      this.ctx.shadowColor = '#ffcc00';
      this.ctx.shadowBlur = Math.max(8, w * 0.15);
      
      // Box body (Crimson Red)
      this.ctx.fillStyle = '#ff3366';
      this.ctx.fillRect(x, y + h * 0.25, w, h * 0.75);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = Math.max(1.5, w * 0.03);
      this.ctx.strokeRect(x, y + h * 0.25, w, h * 0.75);
      
      // Vertical Ribbon (Gold)
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.fillRect(x + w/2 - ribbonW/2, y + h * 0.25, ribbonW, h * 0.75);
      
      // Horizontal Ribbon (Gold)
      this.ctx.fillRect(x, y + h * 0.55 - ribbonW/2, w, ribbonW);
      
      // Ribbon Outlines
      this.ctx.strokeStyle = '#eab308';
      this.ctx.lineWidth = Math.max(1, w * 0.02);
      this.ctx.strokeRect(x + w/2 - ribbonW/2, y + h * 0.25, ribbonW, h * 0.75);
      this.ctx.strokeRect(x, y + h * 0.55 - ribbonW/2, w, ribbonW);
      
      // Ribbon bow at top (ellipse loops)
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.beginPath();
      // Left loop
      this.ctx.ellipse(x + w/2 - ribbonW * 0.6, y + h * 0.18, ribbonW * 0.6, ribbonW * 0.4, -Math.PI/6, 0, Math.PI * 2);
      // Right loop
      this.ctx.ellipse(x + w/2 + ribbonW * 0.6, y + h * 0.18, ribbonW * 0.6, ribbonW * 0.4, Math.PI/6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      
      // Center ribbon knot
      this.ctx.fillStyle = '#eab308';
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, y + h * 0.25, ribbonW * 0.35, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.restore();
    } else if (type === 'wind_turbine') {
      // Wind turbine with rotating blades
      this.ctx.save();
      // 1. Tower pole
      this.ctx.fillStyle = '#1e293b';
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = Math.max(1, w * 0.02);
      this.ctx.beginPath();
      this.ctx.moveTo(x + w/2 - w*0.04, y + h);
      this.ctx.lineTo(x + w/2 - w*0.02, y + h*0.35);
      this.ctx.lineTo(x + w/2 + w*0.02, y + h*0.35);
      this.ctx.lineTo(x + w/2 + w*0.04, y + h);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // 2. Hub / Rotor Center
      const hubX = x + w/2;
      const hubY = y + h*0.35;
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = Math.max(4, w * 0.08);
      this.ctx.beginPath();
      this.ctx.arc(hubX, hubY, Math.max(4, w * 0.05), 0, Math.PI * 2);
      this.ctx.fill();

      // 3. Rotating Blades
      // Determine angle based on performance.now() to make it spin!
      const angle = (performance.now() / 1200) % (Math.PI * 2);
      this.ctx.strokeStyle = '#39ff14'; // neon green blades
      this.ctx.shadowColor = '#39ff14';
      this.ctx.lineWidth = Math.max(2, w * 0.035);

      for (let j = 0; j < 3; j++) {
        const bladeAngle = angle + (j * Math.PI * 2 / 3);
        const endX = hubX + Math.cos(bladeAngle) * (w * 0.45);
        const endY = hubY + Math.sin(bladeAngle) * (w * 0.45);
        this.ctx.beginPath();
        this.ctx.moveTo(hubX, hubY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
      }
      this.ctx.restore();

    } else if (type === 'drone') {
      // Floating Cyber Drone with rotating rotors
      this.ctx.save();
      
      // Determine floating offset using sine wave
      const bobY = Math.sin(performance.now() / 250 + x) * (h * 0.08);
      const droneY = y + h * 0.3 + bobY;
      const droneX = x + w / 2;

      // 1. Support arms (cross structure)
      this.ctx.strokeStyle = '#334155';
      this.ctx.lineWidth = Math.max(1.5, w * 0.035);
      this.ctx.beginPath();
      this.ctx.moveTo(droneX - w*0.4, droneY - h*0.08);
      this.ctx.lineTo(droneX + w*0.4, droneY + h*0.08);
      this.ctx.moveTo(droneX - w*0.4, droneY + h*0.08);
      this.ctx.lineTo(droneX + w*0.4, droneY - h*0.08);
      this.ctx.stroke();

      // 2. Propellers spinning fast
      const propAngle = (performance.now() / 150) % (Math.PI * 2);
      this.ctx.fillStyle = 'rgba(255, 51, 102, 0.4)'; // Crimson neon spinning rotors
      this.ctx.strokeStyle = '#ff3366';
      this.ctx.lineWidth = 1;
      
      const rotorPositions = [
        { rx: -w*0.4, ry: -h*0.08 },
        { rx: w*0.4, ry: h*0.08 },
        { rx: -w*0.4, ry: h*0.08 },
        { rx: w*0.4, ry: -h*0.08 }
      ];

      rotorPositions.forEach(pos => {
        this.ctx.save();
        this.ctx.translate(droneX + pos.rx, droneY + pos.ry);
        this.ctx.rotate(propAngle);
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, w*0.14, w*0.04, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Rotor center
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, Math.max(1.5, w*0.02), 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.restore();
      });

      // 3. Drone central cabin/eye
      this.ctx.fillStyle = '#0f172a';
      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = Math.max(2, w * 0.04);
      this.ctx.beginPath();
      this.ctx.arc(droneX, droneY, w * 0.18, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Glowing core (pulsing eye)
      const pulse = 0.7 + Math.sin(performance.now() / 120) * 0.3;
      this.ctx.fillStyle = `rgba(0, 240, 255, ${pulse})`;
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = Math.max(4, w * 0.1);
      this.ctx.beginPath();
      this.ctx.arc(droneX, droneY, w * 0.08, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();

    } else if (type === 'neon_sign') {
      // High-Contrast Cyber Neon Signs
      this.ctx.save();
      
      // Supporting pole
      const poleW = w * 0.07;
      this.ctx.fillStyle = '#1e293b';
      this.ctx.fillRect(x + w/2 - poleW/2, y + h*0.45, poleW, h*0.55);

      // Sign shape
      const signY = y + h * 0.25;
      const signW = w * 0.9;
      const signH = h * 0.45;
      
      this.ctx.fillStyle = '#030712';
      // Cycle neon glow colors
      const colors = ['#ff0055', '#00ffaa', '#00a9ff', '#ffcc00'];
      const activeColor = colors[Math.floor((performance.now() / 400) % colors.length)];
      
      this.ctx.strokeStyle = activeColor;
      this.ctx.shadowColor = activeColor;
      this.ctx.shadowBlur = Math.max(5, w * 0.08);
      this.ctx.lineWidth = Math.max(2.5, w * 0.035);
      
      this.ctx.beginPath();
      this.ctx.roundRect(x + w/2 - signW/2, signY - signH/2, signW, signH, 12);
      this.ctx.fill();
      this.ctx.stroke();

      // Neon sign interior graphics / text
      const blink = Math.sin(performance.now() / 80) > 0;
      if (blink) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = Math.max(1.5, w * 0.02);
        this.ctx.beginPath();
        // Draw double arrows pointing forward/right
        const arrowX = x + w/2;
        this.ctx.moveTo(arrowX - w*0.2, signY - h*0.12);
        this.ctx.lineTo(arrowX, signY);
        this.ctx.lineTo(arrowX - w*0.2, signY + h*0.12);
        
        this.ctx.moveTo(arrowX, signY - h*0.12);
        this.ctx.lineTo(arrowX + w*0.2, signY);
        this.ctx.lineTo(arrowX, signY + h*0.12);
        this.ctx.stroke();
      }

      // Draw cute neon star above sign
      this.ctx.fillStyle = '#ffcc00';
      this.ctx.shadowColor = '#ffcc00';
      this.ctx.beginPath();
      this.ctx.arc(x + w/2, signY - signH/2 - 8, Math.max(2, w*0.035), 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  // Draw the player's own car externally during the cinematic trailing camera mode
  private drawPlayerCarOutside(theta: number) {
    const playerSeg = this.findSegment(this.playerZ);
    const p1 = playerSeg.p1.screen;
    const p2 = playerSeg.p2.screen;
    if (p1.y <= 0 || p2.y <= 0) return;
    
    // Smoothly interpolate player's car coordinates along the segment length
    const percent = (this.playerZ % this.segmentLength) / this.segmentLength;
    const interpolatedX = p1.x + (p2.x - p1.x) * percent;
    const interpolatedY = p1.y + (p2.y - p1.y) * percent;
    const interpolatedW = p1.w + (p2.w - p1.w) * percent;

    const carX = interpolatedX + (this.playerX * interpolatedW);
    const carY = interpolatedY;
    const scale = interpolatedW / this.roadWidth;
    
    const w = 450 * scale;
    const h = w * 0.55;

    this.ctx.save();
    this.ctx.translate(carX, carY);

    const isRearView = Math.cos(theta) > 0;

    // Body
    this.ctx.fillStyle = this.carColor;
    this.ctx.beginPath();
    this.ctx.roundRect(-w/2, -h, w, h * 0.8, w * 0.15);
    this.ctx.fill();

    // Spoiler (only visible or prominent from rear)
    if (isRearView) {
      this.ctx.fillStyle = '#0f172a';
      this.ctx.fillRect(-w * 0.55, -h * 1.15, w * 1.1, h * 0.25);
      this.ctx.fillRect(-w * 0.4, -h * 0.9, w * 0.08, h * 0.25);
      this.ctx.fillRect(w * 0.32, -h * 0.9, w * 0.08, h * 0.25);
    }

    // Cabin glass
    this.ctx.fillStyle = '#020617';
    this.ctx.beginPath();
    this.ctx.roundRect(-w * 0.35, -h * 0.9, w * 0.7, h * 0.4, w * 0.05);
    this.ctx.fill();

    // Tires
    this.ctx.fillStyle = '#090d16';
    this.ctx.fillRect(-w * 0.48, -h * 0.2, w * 0.15, h * 0.25);
    this.ctx.fillRect(w * 0.33, -h * 0.2, w * 0.15, h * 0.25);

    // Lights
    if (isRearView) {
      // Taillights (Red)
      this.ctx.fillStyle = '#ef4444';
      this.ctx.shadowColor = '#ef4444';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(-w * 0.45, -h * 0.7, w * 0.2, h * 0.15);
      this.ctx.fillRect(w * 0.25, -h * 0.7, w * 0.2, h * 0.15);
    } else {
      // Headlights (Cyan/Neon White)
      this.ctx.fillStyle = '#00ffff';
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(-w * 0.45, -h * 0.6, w * 0.18, h * 0.15);
      this.ctx.fillRect(w * 0.27, -h * 0.6, w * 0.18, h * 0.15);
    }

    this.ctx.restore();
  }

  // Calculate projected Z relative to orbiting camera
  private getOrbitTransZ(worldX: number, worldY: number, worldZ: number, loopCurveSum: number): number {
    const cinematicT = Math.min(1.0, (this.completionTimeElapsed - 2.5) / 6.0);
    const theta = -0.15 + cinematicT * 0.45;
    const D = 1800;
    
    const playerX_abs = this.playerX * this.roadWidth;
    const playerZ_abs = this.playerZ;
    
    let ptZ = worldZ;
    if (ptZ < playerZ_abs - 5000) {
      ptZ += this.segmentCount * this.segmentLength;
    } else if (ptZ > playerZ_abs + this.segmentCount * this.segmentLength - 5000) {
      ptZ -= this.segmentCount * this.segmentLength;
    }
    
    const X_rel = (worldX + loopCurveSum) - playerX_abs;
    const Z_rel = ptZ - playerZ_abs;
    
    const transZ = X_rel * Math.sin(theta) + Z_rel * Math.cos(theta) + D;
    return transZ;
  }

  // Draws AI Opponent Cars with ultra-smooth sub-segment screenspace interpolation
  private drawAICar(car: AICar) {
    const carSegment = this.findSegment(car.z);
    const p1 = carSegment.p1.screen;
    const p2 = carSegment.p2.screen;
    if (p1.y <= 0 || p2.y <= 0) return;

    // Smoothly interpolate AI car coordinates along the segment length
    const percent = (car.z % this.segmentLength) / this.segmentLength;
    const interpolatedX = p1.x + (p2.x - p1.x) * percent;
    const interpolatedY = p1.y + (p2.y - p1.y) * percent;
    const interpolatedW = p1.w + (p2.w - p1.w) * percent;

    const storeState = useGameStore.getState();
    const isCinematicCamera = storeState.isCompleting && this.completionTimeElapsed >= 2.5;

    let carX = interpolatedX + (car.x * interpolatedW);
    let carY = interpolatedY;
    const scale = interpolatedW / this.roadWidth;
    let w = car.width * scale;
    let h = car.width * scale * 0.55;
    let isRearView = true;

    if (isCinematicCamera) {
      const cinematicT = Math.min(1.0, (this.completionTimeElapsed - 2.5) / 6.0);
      const theta = -0.15 + cinematicT * 0.45;
      isRearView = Math.cos(theta) > 0;
    }

    // Draw car sprite using vectors
    this.ctx.save();
    this.ctx.translate(carX, carY);

    // AI Car Body
    this.ctx.fillStyle = car.color;
    this.ctx.beginPath();
    this.ctx.roundRect(-w/2, -h, w, h * 0.8, w * 0.15); // lower body
    this.ctx.fill();

    // Spoiler / Rear Wing
    this.ctx.fillStyle = '#1e293b';
    this.ctx.fillRect(-w*0.55, -h * 1.15, w*1.1, h*0.25);
    // Spoiler struts
    this.ctx.fillRect(-w*0.4, -h * 0.9, w*0.08, h*0.25);
    this.ctx.fillRect(w*0.32, -h * 0.9, w*0.08, h*0.25);

    // AI Car Cabin Glass
    this.ctx.fillStyle = '#020617';
    this.ctx.beginPath();
    this.ctx.roundRect(-w*0.35, -h * 0.9, w*0.7, h * 0.4, w*0.05);
    this.ctx.fill();

    // Wheels / Exhausts
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(-w*0.48, -h*0.2, w*0.15, h*0.25); // tires
    this.ctx.fillRect(w*0.33, -h*0.2, w*0.15, h*0.25);
    
    // Lights (Red for Rear view, Cyan for Front view)
    if (isRearView) {
      this.ctx.fillStyle = '#ef4444'; // glowing tail-light
      this.ctx.fillRect(-w*0.45, -h*0.7, w*0.2, h*0.15);
      this.ctx.fillRect(w*0.25, -h*0.7, w*0.2, h*0.15);
    } else {
      this.ctx.fillStyle = '#00ffff'; // headlights
      this.ctx.fillRect(-w*0.45, -h*0.6, w*0.18, h*0.15);
      this.ctx.fillRect(w*0.27, -h*0.6, w*0.18, h*0.15);
    }

    // Draw Name Tag above the AI car
    this.ctx.save();
    const nameFontSize = Math.max(9, Math.round(14 * scale));
    if (nameFontSize >= 9) {
      this.ctx.font = `900 ${nameFontSize}px "Inter", sans-serif`;
      const textWidth = this.ctx.measureText(car.name).width;
      const paddingX = 8 * scale;
      const paddingY = 4 * scale;
      const bgW = textWidth + paddingX * 2;
      const bgH = nameFontSize + paddingY * 2;
      const bgX = -bgW / 2;
      const bgY = -h - bgH - 10 * scale; // 10px above the car spoiler

      // Draw rounded rect background capsule
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      this.ctx.strokeStyle = car.color;
      this.ctx.lineWidth = Math.max(1, 2 * scale);
      this.ctx.beginPath();
      this.ctx.roundRect(bgX, bgY, bgW, bgH, 6 * scale);
      this.ctx.fill();
      this.ctx.stroke();

      // Draw text
      this.ctx.fillStyle = '#ffffff';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(car.name, 0, bgY + bgH / 2);
    }
    this.ctx.restore();

    this.ctx.restore();
  }

  // Draw HUD dashboard panel and direction steering wheel
  private drawPlayerCockpit() {
    this.ctx.save();
    
    // Smooth wheel turn angle based on key states
    let steeringWheelTurn = 0;
    if (this.keys['a']) steeringWheelTurn = -0.55;
    if (this.keys['d']) steeringWheelTurn = 0.55;

    const scale = this.width / 1200; // responsive scale
    const dashCenter = this.width / 2;
    const dashBottom = this.height;

    // 1. Sleek cockpit border dashboard console
    const consoleGrad = this.ctx.createLinearGradient(0, this.height - 130 * scale, 0, this.height);
    consoleGrad.addColorStop(0, '#1e293b'); // slate dark grey border
    consoleGrad.addColorStop(1, '#020617'); // dark background
    this.ctx.fillStyle = consoleGrad;
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 3;

    // Base dashboard polygon shape
    this.ctx.beginPath();
    this.ctx.moveTo(dashCenter - 480 * scale, dashBottom);
    this.ctx.lineTo(dashCenter - 320 * scale, dashBottom - 110 * scale);
    this.ctx.lineTo(dashCenter - 140 * scale, dashBottom - 110 * scale);
    this.ctx.lineTo(dashCenter - 80 * scale, dashBottom - 140 * scale); // instrument pod center raise
    this.ctx.lineTo(dashCenter + 80 * scale, dashBottom - 140 * scale);
    this.ctx.lineTo(dashCenter + 140 * scale, dashBottom - 110 * scale);
    this.ctx.lineTo(dashCenter + 320 * scale, dashBottom - 110 * scale);
    this.ctx.lineTo(dashCenter + 480 * scale, dashBottom);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // 2. Interactive Digital Speedometer (Center Dashboard)
    const meterX = dashCenter;
    const meterY = dashBottom - 115 * scale;
    const dialRadius = 45 * scale;
    
    // Background dim gauge arc
    this.ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
    this.ctx.lineWidth = 5 * scale;
    this.ctx.beginPath();
    this.ctx.arc(meterX, meterY + 5 * scale, dialRadius, Math.PI * 0.85, Math.PI * 2.15);
    this.ctx.stroke();

    // Foreground active glowing speed gauge arc
    this.ctx.save();
    this.ctx.strokeStyle = '#00ff88';
    this.ctx.shadowColor = '#00ff88';
    this.ctx.shadowBlur = 8 * scale;
    this.ctx.lineWidth = 5 * scale;
    this.ctx.beginPath();
    const speedRatio = Math.min(1.0, this.speed / this.maxSpeed);
    this.ctx.arc(meterX, meterY + 5 * scale, dialRadius, Math.PI * 0.85, Math.PI * (0.85 + 1.3 * speedRatio));
    this.ctx.stroke();
    this.ctx.restore();
    
    // Draw neon speed digital number
    const speedKmh = Math.round(this.speed * 2.2); // scale unit to display km/h
    this.ctx.font = `italic bold ${Math.round(44 * scale)}px "JetBrains Mono", monospace`;
    this.ctx.fillStyle = '#00ff88'; // Neon Emerald glow
    this.ctx.shadowColor = '#00ff88';
    this.ctx.shadowBlur = 10;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(`${speedKmh}`, meterX, meterY);
    
    this.ctx.font = `italic bold ${Math.round(11 * scale)}px "Inter", sans-serif`;
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.shadowBlur = 0; // reset shadow
    this.ctx.fillText("KM/H", meterX, meterY + 28 * scale);

    // 3. Glowing LED rpm/power meter bar
    const barW = 180 * scale;
    const barH = 10 * scale;
    const barX = dashCenter - barW / 2;
    const barY = dashBottom - 160 * scale;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(barX, barY, barW, barH);
    
    const powerPct = this.speed / this.maxSpeed;
    const filledW = barW * powerPct;
    
    // Power gradient bar (Green to Orange to Red)
    const powerGrad = this.ctx.createLinearGradient(barX, 0, barX + barW, 0);
    powerGrad.addColorStop(0, '#10b981'); // Green
    powerGrad.addColorStop(0.7, '#f59e0b'); // Amber
    powerGrad.addColorStop(1, '#ef4444'); // Red
    
    this.ctx.fillStyle = powerGrad;
    this.ctx.fillRect(barX, barY, filledW, barH);

    // 4. Drawing high-tech steering wheel (Left Dashboard side)
    const wheelCenter = dashCenter - 220 * scale;
    const wheelY = dashBottom - 65 * scale;
    const wheelRadius = 55 * scale;

    this.ctx.save();
    this.ctx.translate(wheelCenter, wheelY);
    this.ctx.rotate(steeringWheelTurn * Math.PI); // rotation from steering keys

    // Draw outer thick steering wheel rim
    this.ctx.strokeStyle = this.carColor; // Match player car color preference!
    this.ctx.shadowColor = this.carColor;
    this.ctx.shadowBlur = 6;
    this.ctx.lineWidth = 14 * scale;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    // Reset shadow
    this.ctx.shadowBlur = 0;

    // Draw central spokes (A/D responsive controller)
    this.ctx.fillStyle = '#334155';
    this.ctx.strokeStyle = '#475569';
    this.ctx.lineWidth = 6 * scale;
    
    // Center cap
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 18 * scale, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Spokes left/right/down
    this.ctx.beginPath();
    this.ctx.moveTo(-18 * scale, 0);
    this.ctx.lineTo(-wheelRadius + 6 * scale, 0);
    this.ctx.moveTo(18 * scale, 0);
    this.ctx.lineTo(wheelRadius - 6 * scale, 0);
    this.ctx.moveTo(0, 18 * scale);
    this.ctx.lineTo(0, wheelRadius - 6 * scale);
    this.ctx.stroke();

    // Yellow center marker at top of wheel
    this.ctx.fillStyle = '#f59e0b';
    this.ctx.beginPath();
    this.ctx.arc(0, -wheelRadius, 6 * scale, 0, Math.PI*2);
    this.ctx.fill();

    this.ctx.restore();

    // 5. Left and Right Dashboard Warning screens
    const storeState = useGameStore.getState();
    const qIndex = Math.min(10, storeState.totalAnswered + 1);

    // Draw central Question Progress above RPM Bar
    this.ctx.save();
    this.ctx.font = `bold ${Math.round(10.5 * scale)}px "JetBrains Mono", monospace`;
    this.ctx.fillStyle = '#00ff88';
    this.ctx.shadowColor = '#00ff88';
    this.ctx.shadowBlur = 6 * scale;
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`TAX CHALLENGE: Q_${qIndex} / 10`, dashCenter, barY - 10 * scale);
    this.ctx.restore();

    // Left display: MAPS/GPS layout mock with Digital Speed
    const leftX = dashCenter - 430 * scale;
    const displayY = dashBottom - 85 * scale;
    const displayW = 100 * scale;
    const displayH = 65 * scale;
    
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(leftX, displayY, displayW, displayH);
    this.ctx.strokeStyle = '#475569';
    this.ctx.strokeRect(leftX, displayY, displayW, displayH);

    // Tech lines (GPS mock)
    this.ctx.strokeStyle = '#10b981';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(leftX + 10, displayY + 30);
    this.ctx.lineTo(leftX + displayW - 10, displayY + 15);
    this.ctx.lineTo(leftX + displayW - 20, displayY + displayH - 10);
    this.ctx.stroke();

    // Blinking cursor
    if (Math.floor(performance.now() / 500) % 2 === 0) {
      this.ctx.fillStyle = '#10b981';
      this.ctx.beginPath();
      this.ctx.arc(leftX + displayW/2, displayY + displayH/2, 4, 0, Math.PI*2);
      this.ctx.fill();
    }
    this.ctx.font = `600 ${9 * scale}px "JetBrains Mono", monospace`;
    this.ctx.fillStyle = '#10b981';
    this.ctx.textAlign = 'center';
    this.ctx.fillText("GPS_NAV", leftX + displayW/2, displayY + 12);
    
    // Speed telemetry on Left screen
    this.ctx.font = `bold ${8 * scale}px "JetBrains Mono", monospace`;
    this.ctx.fillStyle = '#34d399';
    this.ctx.fillText(`${speedKmh} KM/H`, leftX + displayW/2, displayY + displayH - 12);

    // Right display: TAX RADAR System Info and Q_PROGRESS
    const rightX = dashCenter + 330 * scale;
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(rightX, displayY, displayW, displayH);
    this.ctx.strokeStyle = '#475569';
    this.ctx.strokeRect(rightX, displayY, displayW, displayH);

    // RADAR Grid lines sweep
    this.ctx.strokeStyle = '#ec4899'; // Pink grid line
    const sweepY = (performance.now() / 25) % displayH;
    this.ctx.beginPath();
    this.ctx.moveTo(rightX, displayY + sweepY);
    this.ctx.lineTo(rightX + displayW, displayY + sweepY);
    this.ctx.stroke();

    this.ctx.fillStyle = '#f43f5e';
    this.ctx.textAlign = 'center';
    this.ctx.font = `bold ${8 * scale}px "JetBrains Mono", monospace`;
    this.ctx.fillText("TAX_RADAR", rightX + displayW/2, displayY + 12);
    
    // Draw Progress Percentage
    const progressPct = Math.round((qIndex / 10) * 100);
    this.ctx.font = `bold ${7.5 * scale}px "JetBrains Mono", monospace`;
    this.ctx.fillStyle = '#ec4899';
    this.ctx.fillText(`PROG: ${progressPct}%`, rightX + displayW/2, displayY + 28);
    
    this.ctx.font = `500 ${7 * scale}px "Inter", sans-serif`;
    this.ctx.fillStyle = '#94a3b8';
    this.ctx.fillText(`STATUS: Q${qIndex}/10`, rightX + displayW/2, displayY + displayH - 12);

    this.ctx.restore();
  }

  // Draw upcoming curve warning indicator
  private drawCurveWarning() {
    if (!this.segments || this.segments.length === 0) return;
    // Scan ahead to find curves (between 15 and 45 segments in front of player)
    let curveSumAhead = 0;
    const playerSegmentIndex = Math.floor(this.playerZ / this.segmentLength);
    for (let i = 15; i < 45; i++) {
      let idx = (playerSegmentIndex + i) % this.segments.length;
      if (isNaN(idx) || idx < 0) idx = 0;
      const aheadSeg = this.segments[idx];
      if (aheadSeg) {
        curveSumAhead += aheadSeg.curve;
      }
    }

    // Threshold for warning trigger (curve magnitude)
    if (Math.abs(curveSumAhead) < 8) return;

    const isRight = curveSumAhead > 0;
    const isSharp = Math.abs(curveSumAhead) > 25;

    // Flashing effect over time (250ms intervals)
    const flash = Math.floor(performance.now() / 250) % 2 === 0;
    if (!flash) return;

    this.ctx.save();
    
    const scale = this.width / 1200;
    const cX = this.width / 2;
    // Positioned below the question gate and above the car cockpit (highly visible central HUD position)
    const cY = this.height * 0.38;
    
    // Glowing warning sign box
    const boxW = 260 * scale;
    const boxH = 48 * scale;
    
    // Sleek dark translucent futuristic plate with glowing borders
    this.ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    this.ctx.strokeStyle = isSharp ? '#ff3366' : '#eab308'; // red neon for sharp, yellow neon for mild curve
    this.ctx.lineWidth = 2.5 * scale;
    this.ctx.shadowColor = isSharp ? '#ff3366' : '#eab308';
    this.ctx.shadowBlur = 12 * scale;
    
    this.ctx.beginPath();
    this.ctx.roundRect(cX - boxW / 2, cY - boxH / 2, boxW, boxH, 10 * scale);
    this.ctx.fill();
    this.ctx.stroke();
    
    // Draw Text & Chevrons
    this.ctx.shadowBlur = 6 * scale;
    this.ctx.fillStyle = isSharp ? '#ff3366' : '#eab308';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    const warningText = isSharp 
      ? (isRight ? "⚠️ 急右彎 SHARP RIGHT" : "⚠️ 急左彎 SHARP LEFT")
      : (isRight ? "⚡ 右彎注意 CURVE RIGHT" : "⚡ 左彎注意 CURVE LEFT");
      
    this.ctx.font = `bold ${Math.round(14.5 * scale)}px "Inter", "Microsoft JhengHei", sans-serif`;
    this.ctx.fillText(warningText, cX, cY);

    // Dynamic flashing direction indicator chevrons
    this.ctx.font = `bold ${Math.round(18 * scale)}px "JetBrains Mono", monospace`;
    if (isRight) {
      this.ctx.fillText(">>>", cX + boxW / 2 - 28 * scale, cY);
    } else {
      this.ctx.fillText("<<<", cX - boxW / 2 + 28 * scale, cY);
    }
    
    this.ctx.restore();
  }

  // Draw top-right rear-view mirror showing trailing cars
  private drawRearViewMirror() {
    this.ctx.save();

    const scale = this.width / 1200;
    
    // Size of the rear view mirror
    const isMobile = this.width < 768;
    const mirrorW = isMobile ? Math.min(180, this.width * 0.45) : Math.min(240, this.width * 0.25);
    const mirrorH = mirrorW * 0.35;
    
    // Position: Below the top stats bar and question banner to avoid any overlap!
    const mirrorX = this.width / 2 - mirrorW / 2;
    const storeState = useGameStore.getState();
    const hasQuestion = !storeState.isCompleting && !!storeState.currentQuestion;
    const mirrorY = hasQuestion
      ? (isMobile ? 210 : 255)
      : (isMobile ? 48 : 62);

    // 1. Draw Outer Glowing border and shell
    this.ctx.shadowBlur = 10 * scale;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2 * scale;
    this.ctx.fillStyle = 'rgba(5, 5, 15, 0.9)'; // Sleek translucent dark tint

    this.ctx.beginPath();
    // Beautiful rounded stadium-like mirror frame
    this.ctx.roundRect(mirrorX, mirrorY, mirrorW, mirrorH, 12 * scale);
    this.ctx.fill();
    this.ctx.stroke();

    // Reset shadow for inner clips
    this.ctx.shadowBlur = 0;

    // 2. Clip the drawing area to inside the mirror so nothing overflows
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.roundRect(mirrorX + 2, mirrorY + 2, mirrorW - 4, mirrorH - 4, 10 * scale);
    this.ctx.clip();

    // 3. Draw Mirror Inner Background (Sky/Horizon)
    const skyGrad = this.ctx.createLinearGradient(mirrorX, mirrorY, mirrorX, mirrorY + mirrorH);
    skyGrad.addColorStop(0, '#02020a');
    skyGrad.addColorStop(0.5, '#0c0721');
    skyGrad.addColorStop(1, '#1b0e35');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(mirrorX, mirrorY, mirrorW, mirrorH);

    // Draw tiny stars in rear view
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    const seed = 42;
    for (let i = 0; i < 8; i++) {
      const starX = mirrorX + ((seed * (i + 1) * 37) % (mirrorW - 10)) + 5;
      const starY = mirrorY + ((seed * (i + 1) * 17) % (mirrorH / 2)) + 2;
      this.ctx.fillRect(starX, starY, 1, 1);
    }

    // 4. Draw Horizon & Perspective Road behind
    const horizonY = mirrorY + mirrorH * 0.45;
    
    // Draw horizon line
    this.ctx.strokeStyle = '#311042';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(mirrorX, horizonY);
    this.ctx.lineTo(mirrorX + mirrorW, horizonY);
    this.ctx.stroke();

    // Draw the road tapering into the horizon
    const roadColor = '#13111c';
    const rumbleColor1 = '#00f0ff';
    const rumbleColor2 = '#ff0055';
    
    // Road coordinates in mirror
    const rx1 = mirrorX + mirrorW * 0.42; 
    const rx2 = mirrorX + mirrorW * 0.58; 
    const rx3 = mirrorX + mirrorW * 0.15; 
    const rx4 = mirrorX + mirrorW * 0.85; 

    this.ctx.fillStyle = roadColor;
    this.ctx.beginPath();
    this.ctx.moveTo(rx1, horizonY);
    this.ctx.lineTo(rx2, horizonY);
    this.ctx.lineTo(rx4, mirrorY + mirrorH);
    this.ctx.lineTo(rx3, mirrorY + mirrorH);
    this.ctx.closePath();
    this.ctx.fill();

    // Draw side rumble strips in mirror
    const animPulse = (performance.now() / 150) % 2 > 1;
    this.ctx.strokeStyle = animPulse ? rumbleColor1 : rumbleColor2;
    this.ctx.lineWidth = 1.5 * scale;
    
    this.ctx.beginPath();
    this.ctx.moveTo(rx1, horizonY);
    this.ctx.lineTo(rx3, mirrorY + mirrorH);
    this.ctx.stroke();

    this.ctx.strokeStyle = animPulse ? rumbleColor2 : rumbleColor1;
    this.ctx.beginPath();
    this.ctx.moveTo(rx2, horizonY);
    this.ctx.lineTo(rx4, mirrorY + mirrorH);
    this.ctx.stroke();

    // 5. Render trailing AI Cars in mirror
    const totalTrackLength = this.segmentCount * this.segmentLength;
    
    this.aiCars.forEach((car) => {
      let relZ = car.z - this.playerZ;
      while (relZ > totalTrackLength / 2) relZ -= totalTrackLength;
      while (relZ < -totalTrackLength / 2) relZ += totalTrackLength;

      // Cars behind player (within 2500 units)
      if (relZ < 0 && relZ > -2500) {
        const pct = -relZ / 2500; 
        const closeness = 1 - pct; 

        const carY = horizonY + (mirrorH * 0.55) * closeness;
        const relX = car.x - this.playerX;
        const roadSpread = (mirrorW * 0.3) * closeness;
        const carX = mirrorX + mirrorW * 0.5 + relX * roadSpread;

        const carW = Math.max(12, 40 * closeness * scale);
        const carH = carW * 0.45;

        this.ctx.save();
        this.ctx.translate(carX, carY);

        // Body fill
        this.ctx.fillStyle = car.color;
        this.ctx.beginPath();
        this.ctx.roundRect(-carW / 2, -carH, carW, carH, 2 * scale);
        this.ctx.fill();

        // Windshield (Front View)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.beginPath();
        this.ctx.roundRect(-carW * 0.35, -carH * 0.85, carW * 0.7, carH * 0.45, 1 * scale);
        this.ctx.fill();

        // Headlights
        const flashLight = Math.floor(performance.now() / 200) % 2 === 0;
        this.ctx.shadowBlur = flashLight ? 8 : 4;
        this.ctx.shadowColor = '#ffffaa';
        this.ctx.fillStyle = '#ffffee';
        
        this.ctx.beginPath();
        this.ctx.arc(-carW * 0.38, -carH * 0.25, Math.max(1.5, carW * 0.08), 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(carW * 0.38, -carH * 0.25, Math.max(1.5, carW * 0.08), 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
      }
    });

    this.ctx.restore();

    // 7. Add HUD label
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.font = `900 ${Math.max(6, 7 * scale)}px "JetBrains Mono", monospace`;
    this.ctx.textAlign = 'center';
    this.ctx.fillText("REAR VIEW 🔍", mirrorX + mirrorW / 2, mirrorY + mirrorH - 4);

    this.ctx.restore();
  }
}
