import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, {
  Rect,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Path,
  Circle,
} from 'react-native-svg';
import { DailySalesMetric } from '../../../../domain/models/Report';
import { TrendingUp, ShoppingBag, IndianRupee, Sparkles } from 'lucide-react-native';

interface SalesBarChartProps {
  data: DailySalesMetric[];
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SalesBarChart: React.FC<SalesBarChartProps> = ({
  data,
  height = 220,
}) => {
  const [metricMode, setMetricMode] = useState<'revenue' | 'orders'>('revenue');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <Text style={styles.emptyText}>No sales data available for this timeframe</Text>
      </View>
    );
  }

  const chartWidth = SCREEN_WIDTH - 64;
  const paddingLeft = 40;
  const paddingRight = 14;
  const paddingTop = 26;
  const paddingBottom = 32;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const values = data.map((d) => (metricMode === 'revenue' ? d.grossSales : d.totalOrders));
  const maxVal = Math.max(...values, metricMode === 'revenue' ? 100 : 1);
  const roundedMax =
    metricMode === 'revenue'
      ? Math.ceil(maxVal / 1000) * 1000 || 1000
      : Math.ceil(maxVal / 5) * 5 || 5;

  const barSlotWidth = innerWidth / data.length;
  const barWidth = Math.min(Math.max(barSlotWidth * 0.58, 8), 28);

  const selectedItem =
    selectedIdx !== null && selectedIdx >= 0 && selectedIdx < data.length
      ? data[selectedIdx]
      : null;

  // Find peak index
  const peakIdx = values.indexOf(Math.max(...values));

  // Compute total & average
  const totalVal = values.reduce((sum, v) => sum + v, 0);
  const avgVal = totalVal / (data.length || 1);

  return (
    <View style={styles.container}>
      {/* Chart Control Header */}
      <View style={styles.chartHeader}>
        <View style={styles.metricToggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, metricMode === 'revenue' && styles.toggleBtnActive]}
            onPress={() => {
              setMetricMode('revenue');
              setSelectedIdx(null);
            }}
            activeOpacity={0.8}
          >
            <IndianRupee size={11} color={metricMode === 'revenue' ? '#D96B14' : '#7C6F62'} />
            <Text
              style={[
                styles.toggleBtnText,
                metricMode === 'revenue' && styles.toggleBtnTextActive,
              ]}
            >
              Revenue (₹)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, metricMode === 'orders' && styles.toggleBtnActive]}
            onPress={() => {
              setMetricMode('orders');
              setSelectedIdx(null);
            }}
            activeOpacity={0.8}
          >
            <ShoppingBag size={11} color={metricMode === 'orders' ? '#D96B14' : '#7C6F62'} />
            <Text
              style={[
                styles.toggleBtnText,
                metricMode === 'orders' && styles.toggleBtnTextActive,
              ]}
            >
              Orders (Count)
            </Text>
          </TouchableOpacity>
        </View>

        {/* Total Summary Badge */}
        <View style={styles.periodTotalPill}>
          <Text style={styles.periodTotalLabel}>
            {metricMode === 'revenue' ? 'TOTAL' : 'TOTAL ORDERS'}
          </Text>
          <Text style={styles.periodTotalValue}>
            {metricMode === 'revenue'
              ? `₹${totalVal.toLocaleString('en-IN')}`
              : `${totalVal} Orders`}
          </Text>
        </View>
      </View>

      {/* Selected Day Inspector Callout Card */}
      {selectedItem ? (
        <View style={styles.inspectorCard}>
          <View style={styles.inspectorRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.inspectorDot} />
              <Text style={styles.inspectorDate}>{selectedItem.date}</Text>
            </View>
            <Text style={styles.inspectorHighlight}>
              {metricMode === 'revenue'
                ? `₹${selectedItem.grossSales.toLocaleString('en-IN')}`
                : `${selectedItem.totalOrders} Orders`}
            </Text>
          </View>
          <View style={styles.inspectorSubRow}>
            <Text style={styles.inspectorSubText}>
              Orders: <Text style={{ color: '#17845A', fontWeight: '700' }}>{selectedItem.completedOrders}</Text>
              {selectedItem.cancelledOrders > 0 && (
                <Text style={{ color: '#DC2626' }}> ({selectedItem.cancelledOrders} cancelled)</Text>
              )}
            </Text>
            <Text style={styles.inspectorSubText}>
              Avg Ticket: <Text style={{ color: '#DE8626', fontWeight: '700' }}>₹{Math.round(selectedItem.averageOrderValue)}</Text>
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>Tap any bar to inspect date & order details</Text>
        </View>
      )}

      {/* SVG Canvas */}
      <View style={styles.svgWrapper}>
        <Svg width={chartWidth} height={height}>
          <Defs>
            <LinearGradient id="goldBarGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#DE8626" stopOpacity="1" />
              <Stop offset="0.6" stopColor="#CB741B" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#8C4B0F" stopOpacity="0.4" />
            </LinearGradient>

            <LinearGradient id="activeBarGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#17845A" stopOpacity="1" />
              <Stop offset="1" stopColor="#0E6240" stopOpacity="0.6" />
            </LinearGradient>

            <LinearGradient id="peakBarGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F59E0B" stopOpacity="1" />
              <Stop offset="1" stopColor="#D96B14" stopOpacity="0.7" />
            </LinearGradient>
          </Defs>

          {/* Reference Grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = paddingTop + innerHeight * (1 - ratio);
            const valLabel = Math.round(roundedMax * ratio);
            let formattedLabel = `${valLabel}`;
            if (metricMode === 'revenue') {
              formattedLabel = valLabel >= 1000 ? `${(valLabel / 1000).toFixed(0)}k` : `${valLabel}`;
            }

            return (
              <React.Fragment key={`grid-line-${ratio}`}>
                <Line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#E7E1DA"
                  strokeDasharray="4, 4"
                  strokeWidth="1"
                />
                <SvgText
                  x={paddingLeft - 8}
                  y={y + 3}
                  fill="#7C6F62"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="end"
                >
                  {formattedLabel}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Render Bars */}
          {data.map((item, idx) => {
            const val = metricMode === 'revenue' ? item.grossSales : item.totalOrders;
            const barHeight = Math.max((val / roundedMax) * innerHeight, 4);
            const x = paddingLeft + idx * barSlotWidth + (barSlotWidth - barWidth) / 2;
            const y = paddingTop + innerHeight - barHeight;
            const isSelected = selectedIdx === idx;
            const isPeak = idx === peakIdx && val > 0;

            const dateParts = item.date.split('-');
            const dayLabel = dateParts.length >= 3 ? `${dateParts[2]}` : item.date.slice(-2);

            let fillGrad = 'url(#goldBarGrad)';
            if (isSelected) fillGrad = 'url(#activeBarGrad)';
            else if (isPeak) fillGrad = 'url(#peakBarGrad)';

            return (
              <React.Fragment key={`bar-elem-${idx}`}>
                {/* Bar Capsule */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={4}
                  fill={fillGrad}
                  opacity={selectedIdx === null || isSelected ? 1 : 0.45}
                />

                {/* Highlight Top Glow Cap for Selected */}
                {isSelected && (
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={3}
                    rx={1.5}
                    fill="#17845A"
                  />
                )}

                {/* X-Axis Date Labels */}
                {(data.length <= 10 || idx % Math.ceil(data.length / 7) === 0 || isSelected) && (
                  <SvgText
                    x={x + barWidth / 2}
                    y={height - 10}
                    fill={isSelected ? '#17845A' : isPeak ? '#DE8626' : '#7C6F62'}
                    fontSize="9"
                    fontWeight={isSelected || isPeak ? 'bold' : 'normal'}
                    textAnchor="middle"
                  >
                    {dayLabel}
                  </SvgText>
                )}
              </React.Fragment>
            );
          })}
        </Svg>

        {/* Full Interactive Touch Layer */}
        <View
          style={[
            styles.touchLayer,
            { left: paddingLeft, width: innerWidth, height: innerHeight, top: paddingTop },
          ]}
        >
          {data.map((item, idx) => (
            <TouchableOpacity
              key={`touch-${idx}`}
              style={{ flex: 1, height: '100%' }}
              activeOpacity={0.7}
              onPress={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
            />
          ))}
        </View>
      </View>

      {/* Footer Daily Average */}
      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterText}>
          Daily Avg:{' '}
          <Text style={{ color: '#DE8626', fontWeight: '800' }}>
            {metricMode === 'revenue'
              ? `₹${Math.round(avgVal).toLocaleString('en-IN')}`
              : `${Math.round(avgVal)} Orders`}
          </Text>
        </Text>
        <Text style={styles.chartFooterText}>
          Best Day:{' '}
          <Text style={{ color: '#D96B14', fontWeight: '800' }}>
            {data[peakIdx]?.date || 'N/A'}
          </Text>
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E1DA',
    marginVertical: 4,
    shadowColor: '#3C2F00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    elevation: 1,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metricToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF7F2',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#DE8626',
  },
  toggleBtnText: {
    color: '#7C6F62',
    fontSize: 10,
    fontWeight: '600',
  },
  toggleBtnTextActive: {
    color: '#D96B14',
    fontWeight: '800',
  },
  periodTotalPill: {
    alignItems: 'flex-end',
  },
  periodTotalLabel: {
    color: '#7C6F62',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  periodTotalValue: {
    color: '#1F2937',
    fontSize: 13,
    fontWeight: '800',
  },
  inspectorCard: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  inspectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#17845A',
  },
  inspectorDate: {
    color: '#1F2937',
    fontSize: 12,
    fontWeight: '700',
  },
  inspectorHighlight: {
    color: '#DE8626',
    fontSize: 14,
    fontWeight: '900',
  },
  inspectorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  inspectorSubText: {
    color: '#5C4E3D',
    fontSize: 10,
  },
  hintRow: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hintText: {
    color: '#7C6F62',
    fontSize: 10,
    fontStyle: 'italic',
  },
  svgWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  touchLayer: {
    position: 'absolute',
    flexDirection: 'row',
  },
  chartFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E7E1DA',
  },
  chartFooterText: {
    color: '#7C6F62',
    fontSize: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7E1DA',
  },
  emptyText: {
    color: '#7C6F62',
    fontSize: 12,
  },
});
