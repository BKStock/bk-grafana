package kinds

themeV0alpha1: {
  kind: "Theme"
  scope: "Namespaced"
  pluralName: "Themes"
  validation: {
    operations: [
      "CREATE",
      "UPDATE",
    ]
  }
  codegen: {
    ts: {
      enabled: true
    }
    go: {
      enabled: true
    }
  }
  schema: {
    spec: {
        title: string
        colors: {
            mode: *"light" | "dark"
            primary?: #ColorSection
            secondary?: #ColorSection
            info?: #ColorSection
            error?: #ColorSection
            success?: #ColorSection
            warning?: #ColorSection        
            text?: {
                primary?: string
                secondary?: string
                disabled?: string
                link?: string
                maxContrast?: string
            }
            background?: {
                canvas?: string
                primary?: string
                secondary?: string
                elevated?: string
            }
            border?: {
                weak?: string
                medium?: string
                strong?: string
            }
            gradients?: {
                brandVertical?: string
                brandHorizontal?: string
            }
            action?: {
                selected?: string
                selectedBorder?: string
                hover?: string
                hoverOpacity?: #NumberBetween0And1
                focus?: string
                disabledBackground?: string
                disabledText?: string
                disabledOpacity?: #NumberBetween0And1
            }
            hoverFactor?: #NumberBetween0And1
            contrastThreshold?: #NumberBetween0And1
            tonalOffset?: #NumberBetween0And1
        }
        spacing?: {
            gridSize?: int
        }
        shape?: {
            borderRadius?: int
        }
        typography?: {
            fontFamily?: string
            fontFamilyMonospace?: string
            fontSize?: #NumberBetween0And1
            fontWeightLight?: #NumberBetween0And1
            fontWeightRegular?: #NumberBetween0And1
            fontWeightMedium?: #NumberBetween0And1
            fontWeightBold?: #NumberBetween0And1
            htmlFontSize?: #NumberBetween0And1
        }
        visualization?: #Visualization
    }
  }
}


#Color: string
#NumberBetween0And1: number // >=0 & <=1

#ColorSection: {
  name?: string
  main?: #Color
  shade?: #Color
  text?: #Color
  border?: #Color
  transparent?: #Color
  borderTransparent?: #Color
  contrastText?: #Color
}

#HueDefinition: {
    primary?: #HueColorDefinition
    super_light?: #HueColorDefinition
    light?: #HueColorDefinition
    semi_dark?: #HueColorDefinition
    dark?: #HueColorDefinition
}

#HueColorDefinition: {
    color: #Color
    aliases?: [...string]
    primary?: bool
}

#Visualization: {
    hues?: {
        red?: #HueDefinition
        orange?: #HueDefinition
        yellow?: #HueDefinition
        green?: #HueDefinition
        blue?: #HueDefinition
        purple?: #HueDefinition
    }
    palette?: [...string]
}


