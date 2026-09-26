use std::collections::BTreeMap;
use serde_json::Value;

pub type References = BTreeMap<String, String>;

/// Byte offsets allow replacement without touching UTF-8 prose. Mirrors src/mentions.ts.
pub fn find(text: &str) -> Vec<(usize, usize, String)> {
    let mut result = Vec::new(); let mut i = 0; let mut code = String::new();
    let bytes = text.as_bytes();
    while i < bytes.len() {
        let ch = text[i..].chars().next().unwrap();
        if ch == '\\' && code.is_empty() {
            i += 1; if i < bytes.len() { i += text[i..].chars().next().unwrap().len_utf8(); } continue;
        }
        if ch == '`' || ch == '~' {
            let mut end = i + 1; while end < bytes.len() && bytes[end] == bytes[i] { end += 1; }
            let marker = &text[i..end];
            if ch == '`' || marker.len() >= 3 {
                if code.is_empty() { code = marker.to_string(); } else if code == marker { code.clear(); }
            }
            i = end; continue;
        }
        let boundary = i == 0 || text[..i].chars().next_back().is_some_and(|c| c.is_whitespace() || "(,;:".contains(c));
        if code.is_empty() && ch == '@' && boundary && text.get(i..i + 6).is_some_and(|s| s.eq_ignore_ascii_case("@image")) {
            let mut end = i + 6;
            if bytes.get(end).is_some_and(|b| (b'1'..=b'9').contains(b)) {
                while bytes.get(end).is_some_and(u8::is_ascii_digit) { end += 1; }
                if !bytes.get(end).is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_') {
                    result.push((i, end, text[i + 1..end].to_ascii_lowercase())); i = end; continue;
                }
            }
        }
        i += ch.len_utf8();
    }
    result
}

pub fn references(session: &Value, images: &[Value]) -> Result<References, String> {
    if session["imageReferences"].is_null() {
        return Ok(images.iter().enumerate().map(|(i, image)| (format!("image{}", i + 1), image["id"].as_str().unwrap_or_default().to_string())).collect());
    }
    let values = session["imageReferences"].as_object().ok_or("Image references are invalid.")?;
    if values.len() > 10000 { return Err("This draft has too many image references. Start a new session.".into()); }
    values.iter().map(|(key, value)| {
        let number = key.strip_prefix("image").filter(|s| !s.is_empty() && !s.starts_with('0') && s.bytes().all(|b| b.is_ascii_digit())).and_then(|s| s.parse::<u32>().ok());
        if number.is_none() { return Err("Image reference names are invalid.".into()); }
        Ok((key.clone(), crate::storage::id(value.as_str().ok_or("Image reference is invalid.")?)?))
    }).collect()
}

pub fn validate(description: &str, refs: &References, images: &[Value]) -> Result<(), String> {
    for (_, _, key) in find(description) {
        if !refs.get(&key).is_some_and(|id| images.iter().any(|image| image["id"].as_str() == Some(id.as_str()))) {
            return Err(format!("@{key} is not attached. Remove the reference or choose another image."));
        }
    }
    Ok(())
}

/// Only uploaded asset URLs enter the final links. Local data and identities are never exposed.
pub fn resolve(description: &str, refs: &References, uploaded: &[(String, String)]) -> Result<String, String> {
    let mut output = String::new(); let mut cursor = 0;
    for (start, end, key) in find(description) {
        let id = refs.get(&key).ok_or("An image reference is missing.")?;
        let (_, url) = uploaded.iter().find(|(image_id, _)| image_id == id).ok_or("A referenced image was not uploaded.")?;
        output.push_str(&description[cursor..start]);
        output.push_str(&format!("[@{key}](<{url}>)")); cursor = end;
    }
    output.push_str(&description[cursor..]);
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn image_links_keep_prose_and_resolve_by_identity_not_order() {
        let refs = References::from([("image1".into(), "a".into()), ("image2".into(), "b".into())]);
        let uploads = vec![("b".into(), "https://uploads.linear.app/b".into()), ("a".into(), "https://uploads.linear.app/a".into())];
        let text = resolve("یہ @image1, then @image2 and @image1.", &refs, &uploads).unwrap();
        assert_eq!(text, "یہ [@image1](<https://uploads.linear.app/a>), then [@image2](<https://uploads.linear.app/b>) and [@image1](<https://uploads.linear.app/a>).");
    }
    #[test]
    fn code_email_urls_and_escaped_mentions_stay_literal() {
        let text = "`@image1`\n```\n@image2\n```\n~~~\n@image3\n~~~\nqa@image4 https://example.com/@image5 \\@image6 @image7suffix [@image8](url) @IMAGE9";
        assert_eq!(find(text).iter().map(|x| x.2.as_str()).collect::<Vec<_>>(), vec!["image9"]);
    }
    #[test]
    fn missing_or_removed_images_stop_submission() {
        let refs = References::from([("image1".into(), "removed".into())]);
        assert!(validate("See @image1", &refs, &[serde_json::json!({"id":"new"})]).is_err());
        assert!(validate("See @image2", &refs, &[]).is_err());
        assert!(resolve("See @image1", &refs, &[]).is_err());
    }
}
