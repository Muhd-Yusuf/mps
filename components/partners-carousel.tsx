"use client"

import React from "react"

const partners = [
    "https://res.cloudinary.com/doyjag1gz/image/upload/v1763647366/5_pcpudr.png",
    "https://res.cloudinary.com/doyjag1gz/image/upload/v1763647365/6_eovfmr.png",
    "https://res.cloudinary.com/doyjag1gz/image/upload/v1763650100/3-min_garwo1.png",
    "https://res.cloudinary.com/doyjag1gz/image/upload/v1763650099/2-min_rnrxw8.png",
    "https://res.cloudinary.com/doyjag1gz/image/upload/v1763676212/Untitled_design_3_woynzu.png",
    "https://res.cloudinary.com/doyjag1gz/image/upload/v1763647361/1_f2a1lu.png",
]

export function PartnersCarousel() {
    return (
        <div className="w-full py-10 overflow-hidden bg-white/5 backdrop-blur-sm border-y border-white/10">
            <div className="max-w-7xl mx-auto px-4 mb-8 text-center">
                <p className="text-2xl font-extrabold text-muted-foreground uppercase tracking-widest">
                    Our Partners
                </p>
            </div>
            <div className="relative w-full flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
                <div className="flex animate-scroll whitespace-nowrap hover:pause-animation">
                    {[...Array(4)].map((_, setIndex) => (
                        <div key={setIndex} className="flex items-center gap-12 mx-6">
                            {partners.map((logo, idx) => (
                                <div
                                    key={`${setIndex}-${idx}`}
                                    className="relative w-48 h-24 flex items-center justify-center transition-all duration-300"
                                >
                                    <img
                                        src={logo}
                                        alt={`Partner ${idx + 1}`}
                                        className="w-full h-full object-contain"
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
