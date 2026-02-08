// veilwatch_catalog_v1.js
// Data-driven character creation catalog (v1). Player-first. DM gets extra permissions elsewhere.
// Loaded as a global for your current non-module frontend.
//
// Usage:
//   window.VW_CHAR_CATALOG.classes
//   window.VW_CHAR_CATALOG.subclassesByClass[classId]
//   window.VW_CHAR_CATALOG.starterPacks
//
// Note: This file contains only data (no gameplay math). Safe to tweak without breaking core logic.

window.VW_CHAR_CATALOG = {
  "meta": {
    "version": "v1",
    "name": "Veilwatch Character Catalog",
    "notes": [
      "Modernized display names, 5E mapping labels for reference.",
      "Starter packs enforce 1 sidearm + 1 primary.",
      "Ammo tracked on weapons (loaded/current/mags), purchased ammo lives in Inventory (Category: Ammo).",
      "Mag rules: mag-fed starts loaded FULL; up to 2 spare mags start EMPTY. Loose-ammo weapons start loaded FULL; loose ammo starts 0."
    ]
  },
  "classes": [
    {
      "id": "rockstar",
      "name": "Rockstar",
      "mapsTo": "Bard"
    },
    {
      "id": "priest",
      "name": "Priest",
      "mapsTo": "Cleric"
    },
    {
      "id": "soldier",
      "name": "Soldier",
      "mapsTo": "Fighter"
    },
    {
      "id": "thief",
      "name": "Thief",
      "mapsTo": "Rogue"
    },
    {
      "id": "professor",
      "name": "Professor",
      "mapsTo": "Wizard"
    },
    {
      "id": "occultist",
      "name": "Occultist",
      "mapsTo": "Warlock"
    },
    {
      "id": "inventor",
      "name": "Inventor",
      "mapsTo": "Artificer"
    },
    {
      "id": "bouncer",
      "name": "Bouncer",
      "mapsTo": "Barbarian"
    },
    {
      "id": "park_ranger",
      "name": "Park Ranger",
      "mapsTo": "Druid"
    },
    {
      "id": "martial_artist",
      "name": "Martial Artist",
      "mapsTo": "Monk"
    },
    {
      "id": "detective",
      "name": "Detective",
      "mapsTo": "Paladin"
    },
    {
      "id": "hunter",
      "name": "Hunter",
      "mapsTo": "Ranger"
    },
    {
      "id": "gifted",
      "name": "Gifted",
      "mapsTo": "Sorcerer"
    }
  ],
  "subclassesByClass": {
    "rockstar": [
      {
        "id": "influencer",
        "name": "Influencer",
        "mapsTo": "College of Eloquence"
      },
      {
        "id": "headliner",
        "name": "Headliner",
        "mapsTo": "College of Glamour"
      },
      {
        "id": "sound_tech",
        "name": "Sound Tech",
        "mapsTo": "College of Creation"
      },
      {
        "id": "street_poet",
        "name": "Street Poet",
        "mapsTo": "College of Lore"
      }
    ],
    "priest": [
      {
        "id": "trauma_chaplain",
        "name": "Trauma Chaplain",
        "mapsTo": "Life Domain"
      },
      {
        "id": "battle_chaplain",
        "name": "Battle Chaplain",
        "mapsTo": "War Domain"
      },
      {
        "id": "investigator_of_the_unknown",
        "name": "Investigator of the Unknown",
        "mapsTo": "Knowledge Domain"
      },
      {
        "id": "shadow_confessor",
        "name": "Shadow Confessor",
        "mapsTo": "Trickery Domain"
      }
    ],
    "soldier": [
      {
        "id": "breacher",
        "name": "Breacher",
        "mapsTo": "Battle Master"
      },
      {
        "id": "operator",
        "name": "Operator",
        "mapsTo": "Champion"
      },
      {
        "id": "tactical_ace",
        "name": "Tactical Ace",
        "mapsTo": "Psi Warrior"
      },
      {
        "id": "heavy_gunner",
        "name": "Heavy Gunner",
        "mapsTo": "Eldritch Knight"
      }
    ],
    "thief": [
      {
        "id": "ghost",
        "name": "Ghost",
        "mapsTo": "Assassin"
      },
      {
        "id": "fixer",
        "name": "Fixer",
        "mapsTo": "Mastermind"
      },
      {
        "id": "infiltrator",
        "name": "Infiltrator",
        "mapsTo": "Arcane Trickster"
      },
      {
        "id": "field_tech",
        "name": "Field Tech",
        "mapsTo": "Thief"
      }
    ],
    "professor": [
      {
        "id": "analyst",
        "name": "Analyst",
        "mapsTo": "Divination"
      },
      {
        "id": "hazard_specialist",
        "name": "Hazard Specialist",
        "mapsTo": "Evocation"
      },
      {
        "id": "bio_occult_researcher",
        "name": "Bio-Occult Researcher",
        "mapsTo": "Necromancy"
      },
      {
        "id": "reality_engineer",
        "name": "Reality Engineer",
        "mapsTo": "Transmutation"
      }
    ],
    "occultist": [
      {
        "id": "patron_the_machine",
        "name": "Patron: The Machine",
        "mapsTo": "The Hexblade"
      },
      {
        "id": "patron_the_choir",
        "name": "Patron: The Choir",
        "mapsTo": "The Great Old One"
      },
      {
        "id": "patron_the_deal",
        "name": "Patron: The Deal",
        "mapsTo": "The Fiend"
      },
      {
        "id": "patron_the_pale",
        "name": "Patron: The Pale",
        "mapsTo": "The Undead"
      }
    ],
    "inventor": [
      {
        "id": "gunsmith",
        "name": "Gunsmith",
        "mapsTo": "Artillerist"
      },
      {
        "id": "combat_medic",
        "name": "Combat Medic",
        "mapsTo": "Alchemist"
      },
      {
        "id": "armor_rig_pilot",
        "name": "Armor Rig Pilot",
        "mapsTo": "Armorer"
      },
      {
        "id": "drone_handler",
        "name": "Drone Handler",
        "mapsTo": "Battle Smith"
      }
    ],
    "bouncer": [
      {
        "id": "riot_tank",
        "name": "Riot Tank",
        "mapsTo": "Path of the Berserker"
      },
      {
        "id": "street_shaman",
        "name": "Street Shaman",
        "mapsTo": "Path of the Totem Warrior"
      },
      {
        "id": "adrenal_spike",
        "name": "Adrenal Spike",
        "mapsTo": "Path of the Zealot"
      }
    ],
    "park_ranger": [
      {
        "id": "urban_wilds",
        "name": "Urban Wilds",
        "mapsTo": "Circle of the Land"
      },
      {
        "id": "storm_caller",
        "name": "Storm Caller",
        "mapsTo": "Circle of the Shepherd (reflavor)"
      },
      {
        "id": "sporewalker",
        "name": "Sporewalker",
        "mapsTo": "Circle of Spores"
      },
      {
        "id": "moonshift",
        "name": "Moonshift",
        "mapsTo": "Circle of the Moon"
      }
    ],
    "martial_artist": [
      {
        "id": "close_quarters",
        "name": "Close Quarters",
        "mapsTo": "Way of the Open Hand"
      },
      {
        "id": "ghost_step",
        "name": "Ghost Step",
        "mapsTo": "Way of Shadow"
      },
      {
        "id": "shock_fist",
        "name": "Shock Fist",
        "mapsTo": "Way of the Astral Self"
      },
      {
        "id": "kinetic_strikes",
        "name": "Kinetic Strikes",
        "mapsTo": "Way of the Kensei"
      }
    ],
    "detective": [
      {
        "id": "internal_affairs",
        "name": "Internal Affairs",
        "mapsTo": "Oath of Devotion"
      },
      {
        "id": "the_warrant",
        "name": "The Warrant",
        "mapsTo": "Oath of Vengeance"
      },
      {
        "id": "the_badge",
        "name": "The Badge",
        "mapsTo": "Oath of the Crown"
      },
      {
        "id": "blacksite_marshal",
        "name": "Blacksite Marshal",
        "mapsTo": "Oath of Conquest"
      }
    ],
    "hunter": [
      {
        "id": "tracker",
        "name": "Tracker",
        "mapsTo": "Hunter"
      },
      {
        "id": "sniper",
        "name": "Sniper",
        "mapsTo": "Gloom Stalker"
      },
      {
        "id": "handler",
        "name": "Handler",
        "mapsTo": "Beast Master"
      },
      {
        "id": "bounty_agent",
        "name": "Bounty Agent",
        "mapsTo": "Monster Slayer"
      }
    ],
    "gifted": [
      {
        "id": "born_hotwire",
        "name": "Born Hotwire",
        "mapsTo": "Wild Magic"
      },
      {
        "id": "bloodline_asset",
        "name": "Bloodline Asset",
        "mapsTo": "Draconic Bloodline"
      },
      {
        "id": "psychic_leak",
        "name": "Psychic Leak",
        "mapsTo": "Aberrant Mind"
      },
      {
        "id": "ghost_signal",
        "name": "Ghost Signal",
        "mapsTo": "Clockwork Soul (reflavor)"
      }
    ]
  },
  "weapons": {
    "sidearms": [
      {
        "id": "compact_pistol",
        "name": "Compact Pistol",
        "ammoModel": "mag",
        "ammoTypeDefault": "9mm"
      },
      {
        "id": "service_pistol",
        "name": "Service Pistol",
        "ammoModel": "mag",
        "ammoTypeDefault": "9mm"
      },
      {
        "id": "heavy_pistol",
        "name": "Heavy Pistol",
        "ammoModel": "mag",
        "ammoTypeDefault": ".45"
      },
      {
        "id": "machine_pistol",
        "name": "Machine Pistol",
        "ammoModel": "mag",
        "ammoTypeDefault": "9mm"
      },
      {
        "id": "revolver",
        "name": "Revolver",
        "ammoModel": "loose",
        "ammoTypeDefault": ".357"
      }
    ],
    "primaries": [
      {
        "id": "smg",
        "name": "SMG",
        "ammoModel": "mag",
        "ammoTypeDefault": "9mm"
      },
      {
        "id": "carbine_rifle",
        "name": "Carbine Rifle",
        "ammoModel": "mag",
        "ammoTypeDefault": "5.56"
      },
      {
        "id": "assault_rifle",
        "name": "Assault Rifle",
        "ammoModel": "mag",
        "ammoTypeDefault": "5.56"
      },
      {
        "id": "battle_rifle",
        "name": "Battle Rifle",
        "ammoModel": "mag",
        "ammoTypeDefault": "7.62"
      },
      {
        "id": "dmr",
        "name": "DMR (Designated Marksman Rifle)",
        "ammoModel": "mag",
        "ammoTypeDefault": "7.62"
      },
      {
        "id": "sniper_rifle",
        "name": "Sniper Rifle",
        "ammoModel": "mag",
        "ammoTypeDefault": "7.62"
      },
      {
        "id": "pump_shotgun",
        "name": "Pump Shotgun",
        "ammoModel": "loose",
        "ammoTypeDefault": "12-gauge shells",
        "tags": [
          "loose-ammo"
        ]
      },
      {
        "id": "compact_shotgun",
        "name": "Compact Shotgun",
        "ammoModel": "loose",
        "ammoTypeDefault": "12-gauge shells",
        "tags": [
          "loose-ammo"
        ]
      },
      {
        "id": "hunting_rifle",
        "name": "Hunting Rifle",
        "ammoModel": "loose",
        "ammoTypeDefault": "7.62",
        "tags": [
          "loose-ammo"
        ]
      },
      {
        "id": "marksman_rifle",
        "name": "Marksman Rifle",
        "ammoModel": "loose",
        "ammoTypeDefault": "7.62",
        "tags": [
          "loose-ammo"
        ]
      }
    ],
    "nonlethal": [
      {
        "id": "taser",
        "name": "Taser",
        "ammoModel": "cell",
        "ammoTypeDefault": "Power Cells"
      },
      {
        "id": "pepper_spray",
        "name": "Pepper Spray",
        "ammoModel": null
      },
      {
        "id": "baton",
        "name": "Baton",
        "ammoModel": null
      },
      {
        "id": "riot_shield",
        "name": "Riot Shield",
        "ammoModel": null
      }
    ],
    "melee": [
      {
        "id": "knife",
        "name": "Knife"
      },
      {
        "id": "crowbar",
        "name": "Crowbar"
      },
      {
        "id": "combat_baton",
        "name": "Combat Baton"
      },
      {
        "id": "hatchet",
        "name": "Hatchet"
      },
      {
        "id": "improvised_weapon",
        "name": "Improvised Weapon"
      }
    ],
    "heavy_restricted": [
      {
        "id": "breaching_charge",
        "name": "Breaching Charge",
        "restricted": true
      },
      {
        "id": "grenade",
        "name": "Grenade",
        "restricted": true
      }
    ]
  },
  "ammo": {
    "types": [
      "9mm",
      ".45",
      ".357",
      "5.56",
      "7.62",
      "12-gauge shells",
      "Power Cells"
    ],
    "variants": [
      {
        "id": "standard",
        "name": "Standard",
        "minLevel": 1
      },
      {
        "id": "hollow_point",
        "name": "Hollow Point",
        "minLevel": 5
      },
      {
        "id": "armor_piercing",
        "name": "Armor Piercing",
        "minLevel": 9
      },
      {
        "id": "specialized",
        "name": "Specialized",
        "minLevel": 13
      }
    ],
    "storageRules": {
      "weaponAmmoLine": "starting/current/loaded + mag count",
      "inventoryAmmo": "Inventory Category: Ammo",
      "magFed": {
        "startsLoaded": "FULL",
        "spareMagsMax": 2,
        "spareMagsStart": "EMPTY"
      },
      "looseAmmo": {
        "startsLoaded": "FULL",
        "startsLoose": 0
      }
    }
  },
  "inventoryItemsByCategory": {
    "Ammo": [
      "9mm Ammo (box)",
      ".45 Ammo (box)",
      ".357 Ammo (box)",
      "5.56 Ammo (box)",
      "7.62 Ammo (box)",
      "12-Gauge Shells (box)",
      "Empty Magazine (pistol)",
      "Empty Magazine (rifle)",
      "Speedloader (revolver)",
      "Weapon Cleaning Kit",
      "Suppressor (attachment)",
      "Optic (red dot)",
      "Optic (scope)",
      "Laser Module",
      "Weapon Light"
    ],
    "Weapons (spares / parts)": [
      "Backup Sidearm (unregistered)",
      "Spare Primary (unregistered)",
      "Folding Knife",
      "Baton",
      "Crowbar",
      "Riot Shield"
    ],
    "Armor": [
      "Light Vest",
      "Medium Plate Carrier",
      "Heavy Tactical Rig",
      "Ballistic Helmet",
      "Plate Set (replacement)",
      "Arm Guards / Leg Guards"
    ],
    "Gear": [
      "Flashlight",
      "Headlamp",
      "Handcuffs / Zip Ties",
      "Multi-tool",
      "Rope / Paracord",
      "Duct Tape",
      "Zip Ties (pack)",
      "Lockpicks",
      "Binoculars",
      "Bolt Cutters",
      "Portable Camera",
      "Evidence Bags",
      "Notebook",
      "Map/Printouts (paper intel)"
    ],
    "Tools": [
      "Hacker Kit (portable)",
      "Electronics Repair Kit",
      "Mechanic Tools",
      "Forensics Kit",
      "Disguise Kit",
      "Demolitions Kit",
      "Drone Controller",
      "Medkit (field)"
    ],
    "Consumables": [
      "Rations (day)",
      "Water (bottle)",
      "Energy Drink",
      "Caffeine Pills",
      "Smoke Grenade",
      "Flashbang"
    ],
    "Medical": [
      "Gauze Pack",
      "Tourniquet",
      "Bandages",
      "Antiseptic Wipes",
      "Painkillers",
      "Stim Patch",
      "Trauma Kit",
      "Med Syringe"
    ],
    "Valuables": [
      "Cash Bundle",
      "Jewelry",
      "Keycard (generic)",
      "Keycard (facility-specific)",
      "Data Drive",
      "Evidence Item (tagged)",
      "Crypto Stick (encrypted)"
    ],
    "Misc": [
      "Phone Burner",
      "Radio / Earpiece",
      "Battery Pack",
      "Chargers/Cables",
      "Spare Clothes",
      "Mask",
      "Gloves",
      "Spray Paint",
      "Lighter",
      "Cigarettes",
      "Tokens/Markers (for tracking)"
    ]
  },
  "starterPacks": {
    "lockedRules": {
      "mustChoose": [
        "one_sidearm",
        "one_primary"
      ],
      "availability": [
        "class_starter_pack",
        "recommended_starter_pack",
        "scratch_no_pack"
      ]
    },
    "recommended": {
      "id": "recommended",
      "name": "Recommended Starter Pack",
      "sidearm": "service_pistol",
      "primary": "carbine_rifle",
      "items": [
        "Light Vest",
        "Flashlight",
        "Multi-tool",
        "Zip Ties (pack)",
        "Gauze Pack",
        "Tourniquet"
      ],
      "notes": [
        "Mag-fed: starts loaded FULL; up to 2 spare mags start EMPTY.",
        "Loose-ammo: starts loaded FULL; loose ammo starts 0."
      ]
    },
    "byClass": {
      "soldier": {
        "sidearm": "service_pistol",
        "primary": "assault_rifle",
        "items": [
          "Medium Plate Carrier",
          "Weapon Light",
          "Optic (red dot)",
          "Trauma Kit"
        ]
      },
      "thief": {
        "sidearm": "compact_pistol",
        "primary": "smg",
        "items": [
          "Light Vest",
          "Lockpicks",
          "Disguise Kit",
          "Zip Ties (pack)",
          "Phone Burner"
        ]
      },
      "detective": {
        "sidearm": "heavy_pistol",
        "primary": "carbine_rifle",
        "items": [
          "Light Vest",
          "Forensics Kit",
          "Evidence Bags",
          "Radio / Earpiece"
        ]
      },
      "hunter": {
        "sidearm": "service_pistol",
        "primary": "dmr",
        "items": [
          "Light Vest",
          "Binoculars",
          "Rope / Paracord",
          "Gauze Pack",
          "Tourniquet"
        ]
      },
      "inventor": {
        "sidearm": "machine_pistol",
        "primary": "smg",
        "items": [
          "Light Vest",
          "Electronics Repair Kit",
          "Battery Pack",
          "Drone Controller"
        ]
      },
      "professor": {
        "sidearm": "compact_pistol",
        "primary": "carbine_rifle",
        "items": [
          "Light Vest",
          "Notebook",
          "Evidence Bags",
          "Battery Pack",
          "Research Kit (flavor)"
        ]
      },
      "priest": {
        "sidearm": "service_pistol",
        "primary": "pump_shotgun",
        "items": [
          "Light Vest",
          "Trauma Kit",
          "Antiseptic Wipes",
          "Chaplain Kit (flavor)"
        ]
      },
      "occultist": {
        "sidearm": "revolver",
        "primary": "compact_shotgun",
        "items": [
          "Light Vest",
          "Ritual Kit (flavor)",
          "Data Drive",
          "Flashlight"
        ]
      },
      "bouncer": {
        "sidearm": "heavy_pistol",
        "primary": "pump_shotgun",
        "items": [
          "Heavy Tactical Rig",
          "Painkillers",
          "Gauze Pack",
          "Tourniquet"
        ]
      },
      "park_ranger": {
        "sidearm": "service_pistol",
        "primary": "hunting_rifle",
        "items": [
          "Light Vest",
          "Rope / Paracord",
          "Hatchet",
          "Binoculars",
          "Rations (day)",
          "Water (bottle)"
        ]
      },
      "martial_artist": {
        "sidearm": "compact_pistol",
        "primary": "smg",
        "items": [
          "Light Vest",
          "Baton",
          "Gloves",
          "Gauze Pack",
          "Tourniquet"
        ]
      },
      "rockstar": {
        "sidearm": "compact_pistol",
        "primary": "smg",
        "items": [
          "Light Vest",
          "Disguise Kit",
          "Phone Burner",
          "Performance Gear (flavor)"
        ]
      },
      "gifted": {
        "sidearm": "service_pistol",
        "primary": "carbine_rifle",
        "items": [
          "Light Vest",
          "Battery Pack",
          "Focus Device (flavor)",
          "Gauze Pack",
          "Tourniquet"
        ]
      }
    },
    "scratch": {
      "id": "scratch",
      "name": "Scratch / No Pack",
      "notes": [
        "Starts with nothing pre-selected. Add weapons/items manually."
      ]
    }
  }
};
