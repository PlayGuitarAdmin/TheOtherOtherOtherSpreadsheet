// Built-in MechWarrior Online mech catalog.
//
// Written from knowledge of MWO, because the MWO data sites are not reachable
// from the build environment. Anything missing or wrong can be fixed in the app
// (Mechs page -> "Add missing mech" / edit a variant), which stores overrides in
// the database, so this file never has to be perfect.
//
// Line format:  Chassis | tons | IS or CL | O (omni) or - | variants
// Variant markers:  *hero   ^champion   !legendary
// Special variants such as "AS7-D(F)" or "LCT-1V(P)" do not need listing: the
// paste parser accepts any "(X)" suffix on a known code.

const RAW = `
Flea|20|IS|-|FLE-4 FLE-15 FLE-17 FLE-19 FLE-20 FLE-HUB*
Locust|20|IS|-|LCT-1E LCT-1M LCT-1V LCT-3M LCT-3S LCT-3V LCT-5M LCT-PB*
Commando|25|IS|-|COM-1B COM-1D COM-2D COM-3A COM-5S COM-TDK*
Mongoose|25|IS|-|MON-66 MON-67 MON-68 MON-122 MON-124 MON-66GC*
Javelin|30|IS|-|JVN-10F JVN-10N JVN-10P JVN-11A JVN-11B JVN-FF*
Spider|30|IS|-|SDR-5D SDR-5K SDR-5V SDR-A*
Urbanmech|30|IS|-|UM-R60 UM-R60L UM-R63 UM-R68 UM-R80 UM-R90 UM-AS7D* UM-K9*
Osiris|30|IS|-|OSR-2C OSR-2D OSR-3C OSR-4C OSR-2L*
Valkyrie|30|IS|-|VLK-QA VLK-QD VLK-QD1 VLK-QF VLK-QT*
Firestarter|35|IS|-|FS9-A FS9-E FS9-H FS9-K FS9-S FS9-S1 FS9-S3 FS9-EMBER*
Jenner|35|IS|-|JR7-D JR7-F JR7-K JR7-O*
Panther|35|IS|-|PNT-8Z PNT-9R PNT-10K PNT-10P PNT-KK*
Raven|35|IS|-|RVN-2X RVN-3L RVN-4X RVN-H*
Wolfhound|35|IS|-|WLF-1 WLF-1A WLF-1B WLF-2 WLF-GR*
Cicada|40|IS|-|CDA-2A CDA-2B CDA-3C CDA-3F CDA-3M CDA-X5*
Assassin|40|IS|-|ASN-21 ASN-23 ASN-27 ASN-101 ASN-DD*
Blackjack|45|IS|-|BJ-1 BJ-1DC BJ-1X BJ-2 BJ-3 BJ-A*
Hatchetman|45|IS|-|HCT-3F HCT-5D HCT-5H HCT-5K HCT-5S HCT-ED*
Phoenix Hawk|45|IS|-|PXH-1 PXH-1B PXH-1D PXH-1K PXH-3D PXH-3S PXH-HK2*
Vindicator|45|IS|-|VND-1AA VND-1R VND-1X VND-3L VND-1SIB*
Centurion|50|IS|-|CN9-A CN9-AH CN9-AL CN9-D CN9-D3D CN9-YLW*
Crab|50|IS|-|CRB-20 CRB-27 CRB-27B CRB-27SL*
Enforcer|50|IS|-|ENF-4P ENF-4R ENF-5D ENF-5P ENF-GH*
Hunchback|50|IS|-|HBK-4G HBK-4H HBK-4J HBK-4P HBK-4SP HBK-GI*
Trebuchet|50|IS|-|TBT-3C TBT-5J TBT-5N TBT-7K TBT-7M TBT-POS*
Uziel|50|IS|-|UZL-2S UZL-3P UZL-3S UZL-8S*
Bushwacker|55|IS|-|BSW-P1 BSW-P2 BSW-S2 BSW-X1 BSW-X2 BSW-HR*
Griffin|55|IS|-|GRF-1E GRF-1N GRF-1S GRF-2N GRF-3M GRF-5M GRF-RJ*
Kintaro|55|IS|-|KTO-18 KTO-19 KTO-20 KTO-GB*
Shadow Hawk|55|IS|-|SHD-2D SHD-2D2 SHD-2H SHD-2K SHD-5M SHD-GD*
Wolverine|55|IS|-|WVR-6K WVR-6R WVR-7D WVR-7K WVR-Q*
Champion|60|IS|-|CHP-1N CHP-1N2 CHP-2N CHP-3N CHP-3P CHP-W*
Dragon|60|IS|-|DRG-1C DRG-1N DRG-5N DRG-FANG* DRG-FLAME*
Lancelot|60|IS|-|LNC25-01 LNC25-02 LNC25-04 LNC25-05 LNC25-KK*
Quickdraw|60|IS|-|QKD-4G QKD-4H QKD-5K QKD-5M QKD-IV4*
Rifleman|60|IS|-|RFL-3C RFL-3N RFL-5D RFL-5M RFL-LGN*
Catapult|65|IS|-|CPLT-A1 CPLT-C1 CPLT-C4 CPLT-K2 CPLT-K3 CPLT-J*
Crusader|65|IS|-|CRD-2R CRD-3D CRD-3K CRD-3R CRD-5M CRD-6M*
Bombardier|65|IS|-|BMB-05A BMB-10D BMB-12D BMB-14K BMB-14C*
JagerMech|65|IS|-|JM6-A JM6-DD JM6-S JM6-FB*
Thunderbolt|65|IS|-|TDR-5S TDR-5SS TDR-9S TDR-9SE TDR-10SE TDR-17S TDR-5S-T*
Archer|70|IS|-|ARC-2K ARC-2R ARC-5S ARC-5W ARC-T*
Cataphract|70|IS|-|CTF-0XP CTF-1X CTF-2X CTF-3D CTF-4X CTF-IM*
Grasshopper|70|IS|-|GHR-5H GHR-5J GHR-5N GHR-5P GHR-C*
Warhammer|70|IS|-|WHM-6D WHM-6R WHM-7M WHM-7S WHM-BW*
Black Knight|75|IS|-|BL-6-KNT BL-6B-KNT BL-7-KNT BL-7-KNT-L BL-P-KNT*
Flashman|75|IS|-|FLS-7K FLS-8K FLS-9B FLS-9C*
Marauder|75|IS|-|MAD-3R MAD-5D MAD-5M MAD-5S MAD-BH2*
Orion|75|IS|-|ON1-K ON1-M ON1-P ON1-V ON1-VA
Thanatos|75|IS|-|TNS-4P TNS-4S TNS-B TNS-ASH*
Awesome|80|IS|-|AWS-8Q AWS-8R AWS-8T AWS-8V AWS-9M AWS-PB*
Charger|80|IS|-|CGR-1A1 CGR-1A5 CGR-3K CGR-C CGR-SA5*
Victor|80|IS|-|VTR-9A VTR-9B VTR-9K VTR-9S VTR-DS*
Zeus|80|IS|-|ZEU-5S ZEU-6S ZEU-6T ZEU-9S ZEU-SK*
BattleMaster|85|IS|-|BLR-1D BLR-1G BLR-1S BLR-2C BLR-3M BLR-3S BLR-1GHE*
Longbow|85|IS|-|LGB-0W LGB-7Q LGB-7V LGB-12C LGB-GRN*
Stalker|85|IS|-|STK-3F STK-3H STK-4N STK-5M STK-5S STK-M*
Cyclops|90|IS|-|CP-10-Q CP-10-Z CP-11-A CP-11-A-DC CP-11-C CP-S*
Highlander|90|IS|-|HGN-732 HGN-732B HGN-733 HGN-733C HGN-733P HGN-HM*
Mauler|90|IS|-|MAL-1P MAL-1R MAL-2P MAL-C MAL-MX90*
Sunder|90|IS|O|SD1-O SD1-OA SD1-OB SD1-OC SD1-OD
Banshee|95|IS|-|BNC-3E BNC-3M BNC-3S BNC-5S BNC-LM*
Corsair|95|IS|-|COR-5R COR-7A COR-7R COR-WSF*
Nightstar|95|IS|-|NSR-9FC NSR-9J NSR-9S NSR-K*
Annihilator|100|IS|-|ANH-1A ANH-1E ANH-1G ANH-1P ANH-2A ANH-1X*
Atlas|100|IS|-|AS7-D AS7-D-DC AS7-K AS7-RS AS7-S AS7-BH*
Fafnir|100|IS|-|FNR-5 FNR-5B FNR-6U FNR-HM*
King Crab|100|IS|-|KGC-000 KGC-0000 KGC-000B KGC-001 KGC-KJ*
Marauder II|100|IS|-|MAD-4A MAD-4L MAD-5A MAD-BH3*
Piranha|20|CL|-|PIR-1 PIR-2 PIR-3 PIR-CL*
Mist Lynx|25|CL|O|MLX-PRIME MLX-A MLX-B MLX-C MLX-G
Arctic Cheetah|30|CL|O|ACH-PRIME ACH-A ACH-B ACH-C
Incubus|30|CL|-|INC-1 INC-2 INC-3 INC-CS*
Kit Fox|30|CL|O|KFX-PRIME KFX-C KFX-D KFX-G KFX-S
Adder|35|CL|O|ADR-PRIME ADR-A ADR-B ADR-D
Cougar|35|CL|O|COU-PRIME COU-A COU-B COU-C COU-D COU-H
Jenner IIC|35|CL|-|JR7-IIC JR7-IIC-2 JR7-IIC-3 JR7-IIC-A JR7-IIC-O*
Griffin IIC|40|CL|-|GRF-IIC GRF-IIC-2 GRF-IIC-3 GRF-IIC-4 GRF-IIC-MA*
Viper|40|CL|O|VPR-PRIME VPR-B VPR-C VPR-D
Ice Ferret|45|CL|O|IFR-PRIME IFR-A IFR-B IFR-C IFR-D
Shadow Cat|45|CL|O|SHC-PRIME SHC-A SHC-B SHC-P
Shadow Hawk IIC|45|CL|-|SHD-IIC SHD-IIC-A SHD-IIC-B SHD-IIC-C SHD-IIC-D
Hunchback IIC|50|CL|-|HBK-IIC HBK-IIC-A HBK-IIC-B HBK-IIC-C HBK-IIC-O*
Huntsman|50|CL|O|HMN-PRIME HMN-A HMN-B HMN-C HMN-P
Nova|50|CL|O|NVA-PRIME NVA-A NVA-B NVA-C NVA-D NVA-S
Vapor Eagle|50|CL|-|VGL-1 VGL-2 VGL-3 VGL-4 VGL-C*
Black Lanner|55|CL|O|BKL-PRIME BKL-A BKL-B BKL-C
Stormcrow|55|CL|O|SCR-PRIME SCR-A SCR-B SCR-C SCR-D
Hellfire|60|CL|-|HLF-1 HLF-2 HLF-3 HLF-AVL*
Mad Dog|60|CL|O|MDD-PRIME MDD-A MDD-B MDD-C
Ebon Jaguar|65|CL|O|EBJ-PRIME EBJ-A EBJ-B EBJ-C
Hellbringer|65|CL|O|HBR-PRIME HBR-A HBR-B HBR-F
Linebacker|65|CL|O|LBK-PRIME LBK-A LBK-B LBK-C
Rifleman IIC|65|CL|-|RFL-IIC RFL-IIC-A RFL-IIC-2 RFL-IIC-3 RFL-IIC-4
Grizzly|70|CL|-|GZL-1 GZL-2 GZL-3 GZL-C*
Nova Cat|70|CL|O|NCT-PRIME NCT-A NCT-B NCT-C
Summoner|70|CL|O|SMN-PRIME SMN-B SMN-C SMN-D SMN-F
Night Gyr|75|CL|O|NTG-PRIME NTG-A NTG-C NTG-D
Orion IIC|75|CL|-|ON1-IIC ON1-IIC-A ON1-IIC-B ON1-IIC-IM*
Timber Wolf|75|CL|O|TBR-PRIME TBR-A TBR-C TBR-D TBR-S
Gargoyle|80|CL|O|GAR-PRIME GAR-A GAR-B GAR-C GAR-D
Naga|80|CL|-|NGA-1 NGA-2 NGA-3 NGA-C*
Warhammer IIC|80|CL|-|WHM-IIC WHM-IIC-A WHM-IIC-B WHM-IIC-C
Marauder IIC|85|CL|-|MAD-IIC MAD-IIC-A MAD-IIC-B MAD-IIC-C MAD-IIC-D
Warhawk|85|CL|O|WHK-PRIME WHK-A WHK-B WHK-C
Highlander IIC|90|CL|-|HGN-IIC HGN-IIC-A HGN-IIC-B HGN-IIC-C
Mad Cat Mk II|90|CL|-|MCII-1 MCII-2 MCII-4 MCII-B MCII-DS*
Supernova|90|CL|-|SNV-1 SNV-2 SNV-3 SNV-A SNV-C*
Executioner|95|CL|O|EXE-PRIME EXE-A EXE-B EXE-C EXE-D
Behemoth|100|CL|-|BHM-1 BHM-2 BHM-3 BHM-C*
Dire Wolf|100|CL|O|DWF-PRIME DWF-A DWF-B DWF-S DWF-W
Kodiak|100|CL|-|KDK-1 KDK-2 KDK-3 KDK-4 KDK-5 KDK-SB*
`;

export const WEIGHT_CLASSES = ['Light', 'Medium', 'Heavy', 'Assault'];

export function weightClass(tons) {
  if (tons <= 35) return 'Light';
  if (tons <= 55) return 'Medium';
  if (tons <= 75) return 'Heavy';
  return 'Assault';
}

const KIND_MARK = { '*': 'hero', '^': 'champion', '!': 'legendary' };

function parse() {
  const variants = [];
  for (const line of RAW.trim().split('\n')) {
    const [chassis, tons, tech, omni, list] = line.split('|');
    for (let code of list.trim().split(/\s+/)) {
      let kind = 'standard';
      const mark = code.at(-1);
      if (KIND_MARK[mark]) {
        kind = KIND_MARK[mark];
        code = code.slice(0, -1);
      } else if (omni === 'O') {
        kind = 'omni';
      }
      variants.push({ code, chassis, tons: Number(tons), tech, kind });
    }
  }
  return variants;
}

export const BUILTIN_VARIANTS = parse();

export const DEFAULT_MAPS = [
  'Alpine Peaks', 'Canyon Network', 'Caustic Valley', 'Crimson Strait', 'Emerald Taiga',
  'Forest Colony', 'Frozen City', 'Grim Plexus', 'HPG Manifold', 'Hellebore Springs',
  'Mining Collective', 'Polar Highlands', 'River City', 'Rubellite Oasis', 'Solaris City',
  'Terra Therma', 'Tourmaline Desert', 'Vitric Forge', 'Viridian Bog',
];
