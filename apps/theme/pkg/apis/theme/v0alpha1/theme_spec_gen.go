// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ThemeColorSection struct {
	Name              *string     `json:"name,omitempty"`
	Main              *ThemeColor `json:"main,omitempty"`
	Shade             *ThemeColor `json:"shade,omitempty"`
	Text              *ThemeColor `json:"text,omitempty"`
	Border            *ThemeColor `json:"border,omitempty"`
	Transparent       *ThemeColor `json:"transparent,omitempty"`
	BorderTransparent *ThemeColor `json:"borderTransparent,omitempty"`
	ContrastText      *ThemeColor `json:"contrastText,omitempty"`
}

// NewThemeColorSection creates a new ThemeColorSection object.
func NewThemeColorSection() *ThemeColorSection {
	return &ThemeColorSection{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeColorSection.
func (ThemeColorSection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeColorSection"
}

// +k8s:openapi-gen=true
type ThemeColor string

// >=0 & <=1
// +k8s:openapi-gen=true
type ThemeNumberBetween0And1 float64

// +k8s:openapi-gen=true
type ThemeVisualization struct {
	Hues    *ThemeV0alpha1VisualizationHues `json:"hues,omitempty"`
	Palette []string                        `json:"palette,omitempty"`
}

// NewThemeVisualization creates a new ThemeVisualization object.
func NewThemeVisualization() *ThemeVisualization {
	return &ThemeVisualization{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeVisualization.
func (ThemeVisualization) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeVisualization"
}

// +k8s:openapi-gen=true
type ThemeHueDefinition struct {
	Primary    *ThemeHueColorDefinition `json:"primary,omitempty"`
	SuperLight *ThemeHueColorDefinition `json:"super_light,omitempty"`
	Light      *ThemeHueColorDefinition `json:"light,omitempty"`
	SemiDark   *ThemeHueColorDefinition `json:"semi_dark,omitempty"`
	Dark       *ThemeHueColorDefinition `json:"dark,omitempty"`
}

// NewThemeHueDefinition creates a new ThemeHueDefinition object.
func NewThemeHueDefinition() *ThemeHueDefinition {
	return &ThemeHueDefinition{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeHueDefinition.
func (ThemeHueDefinition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeHueDefinition"
}

// +k8s:openapi-gen=true
type ThemeHueColorDefinition struct {
	Color   ThemeColor `json:"color"`
	Aliases []string   `json:"aliases,omitempty"`
	Primary *bool      `json:"primary,omitempty"`
}

// NewThemeHueColorDefinition creates a new ThemeHueColorDefinition object.
func NewThemeHueColorDefinition() *ThemeHueColorDefinition {
	return &ThemeHueColorDefinition{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeHueColorDefinition.
func (ThemeHueColorDefinition) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeHueColorDefinition"
}

// +k8s:openapi-gen=true
type ThemeSpec struct {
	Title         string                       `json:"title"`
	Colors        ThemeV0alpha1SpecColors      `json:"colors"`
	Spacing       *ThemeV0alpha1SpecSpacing    `json:"spacing,omitempty"`
	Shape         *ThemeV0alpha1SpecShape      `json:"shape,omitempty"`
	Typography    *ThemeV0alpha1SpecTypography `json:"typography,omitempty"`
	Visualization *ThemeVisualization          `json:"visualization,omitempty"`
}

// NewThemeSpec creates a new ThemeSpec object.
func NewThemeSpec() *ThemeSpec {
	return &ThemeSpec{
		Colors: *NewThemeV0alpha1SpecColors(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeSpec.
func (ThemeSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeSpec"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1VisualizationHues struct {
	Red    *ThemeHueDefinition `json:"red,omitempty"`
	Orange *ThemeHueDefinition `json:"orange,omitempty"`
	Yellow *ThemeHueDefinition `json:"yellow,omitempty"`
	Green  *ThemeHueDefinition `json:"green,omitempty"`
	Blue   *ThemeHueDefinition `json:"blue,omitempty"`
	Purple *ThemeHueDefinition `json:"purple,omitempty"`
}

// NewThemeV0alpha1VisualizationHues creates a new ThemeV0alpha1VisualizationHues object.
func NewThemeV0alpha1VisualizationHues() *ThemeV0alpha1VisualizationHues {
	return &ThemeV0alpha1VisualizationHues{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1VisualizationHues.
func (ThemeV0alpha1VisualizationHues) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1VisualizationHues"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsText struct {
	Primary     *string `json:"primary,omitempty"`
	Secondary   *string `json:"secondary,omitempty"`
	Disabled    *string `json:"disabled,omitempty"`
	Link        *string `json:"link,omitempty"`
	MaxContrast *string `json:"maxContrast,omitempty"`
}

// NewThemeV0alpha1SpecColorsText creates a new ThemeV0alpha1SpecColorsText object.
func NewThemeV0alpha1SpecColorsText() *ThemeV0alpha1SpecColorsText {
	return &ThemeV0alpha1SpecColorsText{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsText.
func (ThemeV0alpha1SpecColorsText) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsText"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsBackground struct {
	Canvas    *string `json:"canvas,omitempty"`
	Primary   *string `json:"primary,omitempty"`
	Secondary *string `json:"secondary,omitempty"`
	Elevated  *string `json:"elevated,omitempty"`
}

// NewThemeV0alpha1SpecColorsBackground creates a new ThemeV0alpha1SpecColorsBackground object.
func NewThemeV0alpha1SpecColorsBackground() *ThemeV0alpha1SpecColorsBackground {
	return &ThemeV0alpha1SpecColorsBackground{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsBackground.
func (ThemeV0alpha1SpecColorsBackground) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsBackground"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsBorder struct {
	Weak   *string `json:"weak,omitempty"`
	Medium *string `json:"medium,omitempty"`
	Strong *string `json:"strong,omitempty"`
}

// NewThemeV0alpha1SpecColorsBorder creates a new ThemeV0alpha1SpecColorsBorder object.
func NewThemeV0alpha1SpecColorsBorder() *ThemeV0alpha1SpecColorsBorder {
	return &ThemeV0alpha1SpecColorsBorder{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsBorder.
func (ThemeV0alpha1SpecColorsBorder) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsBorder"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsGradients struct {
	BrandVertical   *string `json:"brandVertical,omitempty"`
	BrandHorizontal *string `json:"brandHorizontal,omitempty"`
}

// NewThemeV0alpha1SpecColorsGradients creates a new ThemeV0alpha1SpecColorsGradients object.
func NewThemeV0alpha1SpecColorsGradients() *ThemeV0alpha1SpecColorsGradients {
	return &ThemeV0alpha1SpecColorsGradients{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsGradients.
func (ThemeV0alpha1SpecColorsGradients) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsGradients"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsAction struct {
	Selected           *string                  `json:"selected,omitempty"`
	SelectedBorder     *string                  `json:"selectedBorder,omitempty"`
	Hover              *string                  `json:"hover,omitempty"`
	HoverOpacity       *ThemeNumberBetween0And1 `json:"hoverOpacity,omitempty"`
	Focus              *string                  `json:"focus,omitempty"`
	DisabledBackground *string                  `json:"disabledBackground,omitempty"`
	DisabledText       *string                  `json:"disabledText,omitempty"`
	DisabledOpacity    *ThemeNumberBetween0And1 `json:"disabledOpacity,omitempty"`
}

// NewThemeV0alpha1SpecColorsAction creates a new ThemeV0alpha1SpecColorsAction object.
func NewThemeV0alpha1SpecColorsAction() *ThemeV0alpha1SpecColorsAction {
	return &ThemeV0alpha1SpecColorsAction{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsAction.
func (ThemeV0alpha1SpecColorsAction) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsAction"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColors struct {
	Mode              ThemeV0alpha1SpecColorsMode        `json:"mode"`
	Primary           *ThemeColorSection                 `json:"primary,omitempty"`
	Secondary         *ThemeColorSection                 `json:"secondary,omitempty"`
	Info              *ThemeColorSection                 `json:"info,omitempty"`
	Error             *ThemeColorSection                 `json:"error,omitempty"`
	Success           *ThemeColorSection                 `json:"success,omitempty"`
	Warning           *ThemeColorSection                 `json:"warning,omitempty"`
	Text              *ThemeV0alpha1SpecColorsText       `json:"text,omitempty"`
	Background        *ThemeV0alpha1SpecColorsBackground `json:"background,omitempty"`
	Border            *ThemeV0alpha1SpecColorsBorder     `json:"border,omitempty"`
	Gradients         *ThemeV0alpha1SpecColorsGradients  `json:"gradients,omitempty"`
	Action            *ThemeV0alpha1SpecColorsAction     `json:"action,omitempty"`
	HoverFactor       *ThemeNumberBetween0And1           `json:"hoverFactor,omitempty"`
	ContrastThreshold *ThemeNumberBetween0And1           `json:"contrastThreshold,omitempty"`
	TonalOffset       *ThemeNumberBetween0And1           `json:"tonalOffset,omitempty"`
}

// NewThemeV0alpha1SpecColors creates a new ThemeV0alpha1SpecColors object.
func NewThemeV0alpha1SpecColors() *ThemeV0alpha1SpecColors {
	return &ThemeV0alpha1SpecColors{
		Mode: ThemeV0alpha1SpecColorsModeLight,
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColors.
func (ThemeV0alpha1SpecColors) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColors"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecSpacing struct {
	GridSize *int64 `json:"gridSize,omitempty"`
}

// NewThemeV0alpha1SpecSpacing creates a new ThemeV0alpha1SpecSpacing object.
func NewThemeV0alpha1SpecSpacing() *ThemeV0alpha1SpecSpacing {
	return &ThemeV0alpha1SpecSpacing{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecSpacing.
func (ThemeV0alpha1SpecSpacing) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecSpacing"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecShape struct {
	BorderRadius *int64 `json:"borderRadius,omitempty"`
}

// NewThemeV0alpha1SpecShape creates a new ThemeV0alpha1SpecShape object.
func NewThemeV0alpha1SpecShape() *ThemeV0alpha1SpecShape {
	return &ThemeV0alpha1SpecShape{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecShape.
func (ThemeV0alpha1SpecShape) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecShape"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecTypography struct {
	FontFamily          *string                  `json:"fontFamily,omitempty"`
	FontFamilyMonospace *string                  `json:"fontFamilyMonospace,omitempty"`
	FontSize            *ThemeNumberBetween0And1 `json:"fontSize,omitempty"`
	FontWeightLight     *ThemeNumberBetween0And1 `json:"fontWeightLight,omitempty"`
	FontWeightRegular   *ThemeNumberBetween0And1 `json:"fontWeightRegular,omitempty"`
	FontWeightMedium    *ThemeNumberBetween0And1 `json:"fontWeightMedium,omitempty"`
	FontWeightBold      *ThemeNumberBetween0And1 `json:"fontWeightBold,omitempty"`
	HtmlFontSize        *ThemeNumberBetween0And1 `json:"htmlFontSize,omitempty"`
}

// NewThemeV0alpha1SpecTypography creates a new ThemeV0alpha1SpecTypography object.
func NewThemeV0alpha1SpecTypography() *ThemeV0alpha1SpecTypography {
	return &ThemeV0alpha1SpecTypography{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecTypography.
func (ThemeV0alpha1SpecTypography) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecTypography"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsMode string

const (
	ThemeV0alpha1SpecColorsModeLight ThemeV0alpha1SpecColorsMode = "light"
	ThemeV0alpha1SpecColorsModeDark  ThemeV0alpha1SpecColorsMode = "dark"
)

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsMode.
func (ThemeV0alpha1SpecColorsMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsMode"
}
