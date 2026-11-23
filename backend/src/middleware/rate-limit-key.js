import net from 'node:net';

/**
 * Resolve the request address from the standardized Forwarded header.
 *
 * Forwarded is only trusted when the app is configured behind a trusted
 * reverse proxy (TRUST_PROXY > 0). The proxy must overwrite, not append to,
 * client-supplied Forwarded headers. Otherwise a client could rotate values
 * to evade rate limits or spoof another user's address.
 */
export function getForwardedClientIp(req, trustProxyHops) {
  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1) {
    return req.ip;
  }

  const forwarded = req.get('Forwarded');
  if (!forwarded) return req.ip;

  // RFC 7239 allows a comma-separated list of proxy elements. Walk from
  // the trusted edge toward the client, selecting the address at the
  // configured trust boundary. Reject malformed/obfuscated identifiers.
  const elements = forwarded.split(',');
  if (elements.length < trustProxyHops) return req.ip;

  const element = elements[elements.length - trustProxyHops];
  const forMatch = element.match(/(?:^|;)\s*for=(?:"?)(\[[0-9a-fA-F:.]+\]|[0-9a-fA-F:.]+)(?::\d+)?(?:"?)(?=\s*(?:;|$))/i);
  if (!forMatch) return req.ip;

  let address = forMatch[1];
  if (address.startsWith('[') && address.endsWith(']')) {
    address = address.slice(1, -1);
  }
  return net.isIP(address) ? address : req.ip;
}
