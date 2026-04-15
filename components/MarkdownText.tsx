import React from 'react';
import { Text, View, TouchableOpacity, Linking, StyleSheet } from 'react-native';

type Props = {
  text: string;
  textStyle?: any;
  codeStyle?: any;
  linkStyle?: any;
};

function processInline(text: string, styles: any) {
  const regex = /(`([^`]+)`)|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: any[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const idx = match.index;
    if (idx > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, idx) });
    }

    if (match[2]) {
      // inline code `code`
      parts.push({ type: 'code', content: match[2] });
    } else if (match[3]) {
      // bold **text**
      parts.push({ type: 'bold', content: match[3] });
    } else if (match[4]) {
      // italic *text*
      parts.push({ type: 'italic', content: match[4] });
    } else if (match[5] && match[6]) {
      // link [text](url)
      parts.push({ type: 'link', content: match[5], href: match[6] });
    }

    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });

  return parts.map((p, i) => {
    if (p.type === 'text') return <Text key={`t${i}`}>{p.content}</Text>;
    if (p.type === 'code') return (
      <Text key={`c${i}`} style={[styles.code, styles.inlineCode]}>`{p.content}`</Text>
    );
    if (p.type === 'bold') return <Text key={`b${i}`} style={styles.bold}>{p.content}</Text>;
    if (p.type === 'italic') return <Text key={`i${i}`} style={styles.italic}>{p.content}</Text>;
    if (p.type === 'link')
      return (
        <Text
          key={`l${i}`}
          style={styles.link}
          onPress={() => {
            try {
              Linking.openURL(p.href);
            } catch {}
          }}>
          {p.content}
        </Text>
      );
    return null;
  });
}

export default function MarkdownText({ text, textStyle, codeStyle, linkStyle }: Props) {
  const styles = StyleSheet.create({
    code: { fontFamily: 'monospace', backgroundColor: '#0f172a', color: '#e6f0ff', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
    inlineCode: { fontSize: 12 },
    bold: { fontWeight: '700' },
    italic: { fontStyle: 'italic' },
    link: { color: '#3b82f6', textDecorationLine: 'underline' },
    paragraph: { marginBottom: 6 },
  });

  // Split by fenced code blocks ```code``` to render blocks separately
  const parts = text.split(/```([\s\S]*?)```/);

  return (
    <View>
      {parts.map((part, idx) => {
        if (idx % 2 === 1) {
          // code block
          return (
            <View key={`codeblock-${idx}`} style={{ marginVertical: 6 }}>
              <Text style={[styles.code, codeStyle]}>{part}</Text>
            </View>
          );
        }

        // inline processing (may include newlines)
        const lines = part.split('\n');
        return (
          <View key={`para-${idx}`} style={styles.paragraph}>
            {lines.map((line, li) => (
              <Text key={`line-${li}`} style={textStyle}>
                {processInline(line, { ...styles, code: codeStyle ?? styles.code, link: linkStyle ?? styles.link })}
                {li < lines.length - 1 ? '\n' : null}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}
