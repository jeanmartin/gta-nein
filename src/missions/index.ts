import { m1 } from './m1_anmeldung';
import { m2 } from './m2_wartenummer';
import { m3 } from './m3_muelltrennung';
import { m4 } from './m4_sonntagsruhe';
import { m5 } from './m5_tuev';
import { m6 } from './m6_dackel';
import { m7 } from './m7_autobahn';
import { m8 } from './m8_steuererklaerung';
import type { Mission } from './types';

export const MISSIONS: Mission[] = [m1, m2, m3, m4, m5, m6, m7, m8];
