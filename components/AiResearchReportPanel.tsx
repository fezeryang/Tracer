import React from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '../designTokens';
import type { StockAnalysisReport } from '../types';
import { Language, t } from '../i18n';

interface AiResearchReportPanelProps {
  report: StockAnalysisReport;
  language: Language;
}

export const AiResearchReportPanel: React.FC<AiResearchReportPanelProps> = ({ report, language }) => {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set([
      'investmentContext',
      'executiveSummary',
      'dataQualityAssessment',
      'priceActionAnalysis',
      'fundamentalsAnalysis',
      'newsAndEventsAnalysis',
      'sourceTrustAnalysis',
      'volatilityAndOptionsAnalysis',
      'risks',
      'followUpChecklist',
      'conclusion',
    ])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  const insufficientText = t(language, 'report.insufficientSectionData');

  const renderRichText = (contentStr: string) => {
    const lines = contentStr.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return <p>{insufficientText}</p>;

    const bulletPattern = /^([-*•]|\d+[.)]|[（(]?\d+[）)])\s*/;
    const allBullets = lines.length > 1 && lines.every((line) => bulletPattern.test(line));
    const isZh = language === 'zh';

    if (allBullets) {
      return (
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          {lines.map((line, idx) => (
            <li
              key={idx}
              style={{
                marginBottom: idx < lines.length - 1 ? (isZh ? '8px' : '10px') : 0,
                ...(isZh ? theme.typography.chineseBody : {}),
              }}
            >
              {line.replace(bulletPattern, '')}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <>
        {lines.map((line, idx) => (
          <p
            key={idx}
            style={{
              marginBottom: idx < lines.length - 1 ? (isZh ? '14px' : '12px') : '0',
              ...(isZh ? theme.typography.chineseBody : {}),
            }}
          >
            {line.replace(bulletPattern, '')}
          </p>
        ))}
      </>
    );
  };

  const renderSection = (
    title: string,
    content: string | string[] | null | undefined,
    sectionKey: string,
    icon?: React.ReactNode,
    subtitle?: string,
    sectionNumber?: string
  ) => {
    const isEmpty = !content;
    const panel = isEmpty ? panelStyle : aiReportPanelStyle;
    const headerClickProps = isEmpty ? {} : {
      onClick: () => toggleSection(sectionKey),
      style: { cursor: 'pointer' as const, userSelect: 'none' as const },
    };

    return (
      <div
        key={sectionKey}
        style={{
          ...panel,
          opacity: isEmpty ? 0.5 : 1,
        }}
      >
        <div
          style={sectionHeaderStyle}
          {...headerClickProps}
        >
          {sectionNumber && (
            <span style={sectionNumberStyle}>
              {sectionNumber}
            </span>
          )}
          {icon && <span style={{ marginRight: '8px' }}>{icon}</span>}
          <span style={sectionTitleStyle}>{title}</span>
          {!isEmpty && (
            <span style={{ marginLeft: 'auto', color: theme.colors.textMuted, display: 'flex', alignItems: 'center' }}>
              <ChevronDown
                size={14}
                style={{
                  transition: 'transform 0.2s',
                  transform: isExpanded(sectionKey) ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </span>
          )}
        </div>
        {subtitle && (
          <div style={{ fontSize: '12px', color: theme.colors.textMuted, marginTop: '4px', marginBottom: isExpanded(sectionKey) ? '12px' : '0', paddingLeft: '10px' }}>
            {subtitle}
          </div>
        )}
        {!isEmpty && isExpanded(sectionKey) && (
          <div style={{
            ...sectionContentStyle,
            ...(language === 'zh' ? theme.typography.chineseBody : {}),
          }}>
            {renderRichText(Array.isArray(content) ? content.join('\n') : content)}
          </div>
        )}
        {isEmpty && (
          <div style={{ ...sectionContentStyle, paddingLeft: '10px' }}>
            {insufficientText}
          </div>
        )}
      </div>
    );
  };

  const renderRisksGrid = (risks: string[] | null | undefined) => {
    if (!risks || risks.length === 0) {
      return (
        <div style={aiReportPanelStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>{t(language, 'report.risks')}</span>
          </div>
          <div style={{ ...sectionContentStyle, paddingLeft: '10px', opacity: 0.5 }}>
            {insufficientText}
          </div>
        </div>
      );
    }

    return (
      <div style={aiReportPanelStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>{t(language, 'report.keyRisks')}</span>
          <span style={{ marginLeft: '8px', fontSize: '12px', color: theme.colors.textMuted }}>
            ({risks.length})
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '10px',
          marginTop: '12px',
        }}>
          {risks.map((risk, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                backgroundColor: theme.colors.cardAltBg,
                border: `1px solid ${theme.colors.borderSubtle}`,
                borderRadius: theme.radius.cardSmall,
                fontSize: '13px',
                lineHeight: '1.5',
                display: 'flex',
                alignItems: 'flex-start',
              }}
            >
              <span style={{ color: theme.colors.semantic.down, marginRight: '8px', flexShrink: 0, fontSize: '12px', fontWeight: 700 }}>!</span>
              <span style={{ fontSize: '13px', lineHeight: '1.5' }}>{risk}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChecklist = (items: string[] | null | undefined) => {
    if (!items || items.length === 0) {
      return (
        <div style={aiReportPanelStyle}>
          <div style={sectionHeaderStyle}>
            <span style={sectionTitleStyle}>{t(language, 'report.followUpChecklist')}</span>
          </div>
          <div style={{ ...sectionContentStyle, paddingLeft: '10px', opacity: 0.5 }}>
            {insufficientText}
          </div>
        </div>
      );
    }

    return (
      <div style={aiReportPanelStyle}>
        <div style={sectionHeaderStyle}>
          <span style={sectionTitleStyle}>{t(language, 'report.followUpChecklist')}</span>
          <span style={{ marginLeft: '8px', fontSize: '12px', color: theme.colors.textMuted }}>
            ({items.length})
          </span>
        </div>
        <div style={{ marginTop: '12px' }}>
          {items.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '8px 0',
                borderBottom: idx < items.length - 1 ? `1px solid ${theme.colors.borderSubtle}` : 'none',
              }}
            >
              <span style={{
                width: '16px',
                height: '16px',
                minWidth: '16px',
                borderRadius: '4px',
                border: `1px solid ${theme.colors.borderStrong}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '10px',
                marginTop: '2px',
                fontSize: '10px',
                fontWeight: 600,
                color: theme.colors.accentSoft,
                backgroundColor: theme.colors.accentBg,
                flexShrink: 0,
              }}>
                {idx + 1}
              </span>
              <span style={{ fontSize: '13px', lineHeight: '1.5', flex: 1 }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getDataQualityRating = (): { label: string; color: string } => {
    const analysis = report.dataQualityAssessment || report.dataAvailabilityAnalysis || '';
    const lowerAnalysis = analysis.toLowerCase();

    if (language === 'zh') {
      if (lowerAnalysis.includes('优秀') || lowerAnalysis.includes('excellent')) {
        return { label: t(language, 'report.dataQualityRating.excellent'), color: theme.colors.semantic.up };
      }
      if (lowerAnalysis.includes('良好') || lowerAnalysis.includes('good')) {
        return { label: t(language, 'report.dataQualityRating.good'), color: theme.colors.semantic.up };
      }
      if (lowerAnalysis.includes('较差') || lowerAnalysis.includes('poor')) {
        return { label: t(language, 'report.dataQualityRating.poor'), color: theme.colors.semantic.down };
      }
      return { label: t(language, 'report.dataQualityRating.limited'), color: theme.colors.semantic.warn };
    } else {
      if (lowerAnalysis.includes('excellent')) {
        return { label: t(language, 'report.dataQualityRating.excellent'), color: theme.colors.semantic.up };
      }
      if (lowerAnalysis.includes('good')) {
        return { label: t(language, 'report.dataQualityRating.good'), color: theme.colors.semantic.up };
      }
      if (lowerAnalysis.includes('poor')) {
        return { label: t(language, 'report.dataQualityRating.poor'), color: theme.colors.semantic.down };
      }
      return { label: t(language, 'report.dataQualityRating.limited'), color: theme.colors.semantic.warn };
    }
  };

  const qualityRating = getDataQualityRating();

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>{t(language, 'report.aiResearchReport')}</h2>
          <div style={headerBadgesStyle}>
            <span style={{
              ...badgeStyle,
              backgroundColor: report.aiProvider === 'deepseek'
                ? theme.colors.success.soft
                : theme.colors.warning.soft,
              color: report.aiProvider === 'deepseek'
                ? theme.colors.semantic.up
                : theme.colors.semantic.warn,
            }}>
              {report.aiProvider === 'deepseek' ? t(language, 'report.deepSeekBadge') : t(language, 'report.fallbackBadge')}
            </span>
            <span style={{
              ...badgeStyle,
              backgroundColor: qualityRating.color === theme.colors.semantic.up
                ? theme.colors.success.soft
                : qualityRating.color === theme.colors.semantic.down
                  ? theme.colors.danger.soft
                  : theme.colors.warning.soft,
              color: qualityRating.color,
            }}>
              {qualityRating.label}
            </span>
          </div>
        </div>
      </div>

      {/* Investment Context */}
      {renderSection(
        t(language, 'report.investmentContext'),
        report.investmentContext,
        'investmentContext',
        undefined,
        undefined,
        '01'
      )}

      {/* Executive Summary */}
      {renderSection(
        t(language, 'report.executiveSummary'),
        report.executiveSummary || report.summary,
        'executiveSummary',
        undefined,
        undefined,
        '02'
      )}

      {/* Data Quality Assessment */}
      {renderSection(
        t(language, 'report.dataQualityAssessment'),
        report.dataQualityAssessment || report.dataAvailabilityAnalysis,
        'dataQualityAssessment',
        undefined,
        undefined,
        '03'
      )}

      {/* Price Action Analysis */}
      {renderSection(
        t(language, 'report.priceActionAnalysis'),
        report.priceActionAnalysis || report.priceAnalysis,
        'priceActionAnalysis',
        undefined,
        undefined,
        '04'
      )}

      {/* Fundamentals Analysis */}
      {renderSection(
        t(language, 'report.fundamentalsAnalysis'),
        report.fundamentalsAnalysis,
        'fundamentalsAnalysis',
        undefined,
        undefined,
        '05'
      )}

      {/* News & Events Analysis */}
      {renderSection(
        t(language, 'report.newsAndEventsAnalysis'),
        report.newsAndEventsAnalysis || report.newsAnalysis,
        'newsAndEventsAnalysis',
        undefined,
        undefined,
        '06'
      )}

      {/* Source Trust Analysis */}
      {renderSection(
        t(language, 'report.sourceTrustAnalysis'),
        report.sourceTrustAnalysis,
        'sourceTrustAnalysis',
        undefined,
        undefined,
        '07'
      )}

      {/* Volatility & Options Analysis */}
      {renderSection(
        t(language, 'report.volatilityAndOptionsAnalysis'),
        report.volatilityAndOptionsAnalysis,
        'volatilityAndOptionsAnalysis',
        undefined,
        undefined,
        '08'
      )}

      {/* Key Risks */}
      {renderRisksGrid(report.keyRisks || report.risks)}

      {/* Follow-up Checklist */}
      {renderChecklist(report.followUpChecklist)}

      {/* Conclusion */}
      {renderSection(
        t(language, 'report.conclusion'),
        report.conclusion,
        'conclusion',
        undefined,
        undefined,
        '09'
      )}

      {/* Disclaimer */}
      <div style={{
        ...panelStyle,
        backgroundColor: theme.colors.danger.soft,
        borderColor: theme.colors.danger.default,
      }}>
        <div style={{
          fontSize: '12px',
          color: theme.colors.textSecondary,
          lineHeight: '1.5',
        }}>
          {report.disclaimer}
        </div>
      </div>
    </div>
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const panelStyle: React.CSSProperties = {
  backgroundColor: theme.colors.background.elevated,
  border: `1px solid ${theme.colors.borderSubtle}`,
  borderRadius: theme.radius.card,
  padding: '20px',
};

const aiReportPanelStyle: React.CSSProperties = {
  backgroundColor: theme.colors.background.elevated,
  border: `1px solid ${theme.colors.borderSubtle}`,
  borderRadius: theme.radius.card,
  padding: '20px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '8px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: theme.colors.textPrimary,
  margin: 0,
};

const headerBadgesStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  marginTop: '8px',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: '12px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '14px',
  fontWeight: 500,
  color: theme.colors.textSecondary,
  marginBottom: '12px',
  paddingLeft: '10px',
  borderLeft: `2px solid ${theme.colors.accentSoft}`,
};

const sectionTitleStyle: React.CSSProperties = {
  color: theme.colors.textPrimary,
};

const sectionContentStyle: React.CSSProperties = {
  ...theme.typography.bodyMd,
  color: theme.colors.textSecondary,
};

const sectionNumberStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 700,
  color: theme.colors.accentSoft,
  minWidth: '28px',
  letterSpacing: '0.04em',
};

export default AiResearchReportPanel;
