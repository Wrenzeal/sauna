package catalogpkg

import (
	"strings"
	"testing"
)

func validPackage() Package {
	return Package{
		Manifest:     Manifest{SchemaVersion: 1, Slug: "steve-jobs", DisplayName: "Steve Jobs", Summary: "产品与组织判断", Categories: []string{"产品"}, SourceURLs: []string{"https://example.com/source"}},
		SystemPrompt: "Stay in character.",
		Skill:        strings.Join([]string{"表达 DNA", "核心心智模型", "决策启发式", "反模式", "诚实边界"}, "\n"),
	}
}

func TestPackageValidateAcceptsCuratedPackage(t *testing.T) {
	if err := validPackage().Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}
}

func TestPackageValidateRejectsUnsafeSlugAndURL(t *testing.T) {
	p := validPackage()
	p.Manifest.Slug = "Steve Jobs"
	if err := p.Validate(); err == nil {
		t.Fatal("expected invalid slug error")
	}
	p = validPackage()
	p.Manifest.SourceURLs = []string{"http://127.0.0.1/private"}
	if err := p.Validate(); err == nil {
		t.Fatal("expected private URL error")
	}
}
