/**
 * @module types/events
 * @description Event catalog for the Node Zero reactive system.
 *
 * All primitives emit typed events to decouple components. Events are
 * processed asynchronously through an EventEmitter pattern, enabling
 * the reactive event loop that powers the Cognitive Shield agent and
 * scope tier transitions.
 */

import type { NodeId, LayerId, Normalized, UnixTimestamp } from "./branded.js";
import type { NodeZeroIdentity, RotationCertificate, MigrationCertificate, RecoveryStatement } from "./identity.js";
import type { NodeZeroState, ScopeTier, RemoteStateUpdate } from "./state.js";
import type { TrustTier, BondStatus, BondMessage, NodeZeroBond } from "./bond.js";
import type { DiscoveredPeer, TransportMedium } from "./transport.js";
import type { LayerMetadata } from "./vault.js";

// ─── Identity Events ────────────────────────────────────────────────

/** Emitted when a new keypair is generated (genesis event). */
export interface IdentityProvisionedEvent {
  readonly type: "IDENTITY_PROVISIONED";
  readonly identity: NodeZeroIdentity;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a key rotation completes successfully. */
export interface IdentityRotatedEvent {
  readonly type: "IDENTITY_ROTATED";
  readonly certificate: RotationCertificate;
  readonly newNodeId: NodeId;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when identity migration to a new device completes. */
export interface IdentityMigratedEvent {
  readonly type: "IDENTITY_MIGRATED";
  readonly certificate: MigrationCertificate;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when identity status changes (active → deprecated, etc.). */
export interface IdentityStatusChangedEvent {
  readonly type: "IDENTITY_STATUS_CHANGED";
  readonly nodeId: NodeId;
  readonly oldStatus: string;
  readonly newStatus: string;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when social recovery completes with M-of-N threshold met. */
export interface IdentityRecoveredEvent {
  readonly type: "IDENTITY_RECOVERED";
  readonly newNodeId: NodeId;
  readonly statements: readonly RecoveryStatement[];
  readonly timestamp: UnixTimestamp;
}

// ─── State Events ───────────────────────────────────────────────────

/** Emitted when any axis of the local state vector changes beyond threshold. */
export interface StateChangedEvent {
  readonly type: "STATE_CHANGED";
  readonly state: NodeZeroState;
  readonly delta: number;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when the scope tier transitions (e.g., PATTERN → REFLEX). */
export interface ScopeTierChangedEvent {
  readonly type: "SCOPE_TIER_CHANGED";
  readonly previousTier: ScopeTier;
  readonly currentTier: ScopeTier;
  readonly spoons: number;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a bonded peer's state update is received and processed. */
export interface RemoteStateReceivedEvent {
  readonly type: "REMOTE_STATE_RECEIVED";
  readonly update: RemoteStateUpdate;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a bonded peer's state expires (no update within TTL). */
export interface PeerOfflineEvent {
  readonly type: "PEER_OFFLINE";
  readonly peerId: NodeId;
  readonly lastSeen: UnixTimestamp;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when Q coherence value changes (Trimtab adjustment). */
export interface CoherenceChangedEvent {
  readonly type: "COHERENCE_CHANGED";
  readonly qValue: Normalized;
  readonly beaconActive: boolean;
  readonly timestamp: UnixTimestamp;
}

// ─── Vault Events ───────────────────────────────────────────────────

/** Emitted when a new vault layer is created. */
export interface VaultLayerCreatedEvent {
  readonly type: "VAULT_LAYER_CREATED";
  readonly layerId: LayerId;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when data is written to a vault layer. */
export interface VaultLayerWrittenEvent {
  readonly type: "VAULT_LAYER_WRITTEN";
  readonly layerId: LayerId;
  readonly sizeBytes: number;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when access is granted to a bonded identity. */
export interface VaultAccessGrantedEvent {
  readonly type: "VAULT_ACCESS_GRANTED";
  readonly layerId: LayerId;
  readonly bondId: NodeId;
  readonly permissions: string;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when access is revoked from a bonded identity. */
export interface VaultAccessRevokedEvent {
  readonly type: "VAULT_ACCESS_REVOKED";
  readonly layerId: LayerId;
  readonly bondId: NodeId;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when vault storage approaches capacity (70% threshold). */
export interface VaultCapacityWarningEvent {
  readonly type: "VAULT_CAPACITY_WARNING";
  readonly usedBytes: number;
  readonly totalBytes: number;
  readonly percentage: number;
  readonly timestamp: UnixTimestamp;
}

// ─── Bond Events ────────────────────────────────────────────────────

/** Emitted when a new bond is successfully formed. */
export interface BondFormedEvent {
  readonly type: "BOND_FORMED";
  readonly bond: NodeZeroBond;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a bond's trust tier changes. */
export interface BondTrustChangedEvent {
  readonly type: "BOND_TRUST_CHANGED";
  readonly peerId: NodeId;
  readonly previousTier: TrustTier;
  readonly currentTier: TrustTier;
  readonly careScore: Normalized;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a bond's care score is recalculated. */
export interface CareScoreUpdatedEvent {
  readonly type: "CARE_SCORE_UPDATED";
  readonly peerId: NodeId;
  readonly score: Normalized;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a bond is terminated (by either party). */
export interface BondTerminatedEvent {
  readonly type: "BOND_TERMINATED";
  readonly peerId: NodeId;
  readonly reason: number;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when bond status changes (PENDING → ACTIVE, etc.). */
export interface BondStatusChangedEvent {
  readonly type: "BOND_STATUS_CHANGED";
  readonly peerId: NodeId;
  readonly previousStatus: BondStatus;
  readonly currentStatus: BondStatus;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when the tetrahedron topology constraint would be violated. */
export interface TopologyViolationEvent {
  readonly type: "TOPOLOGY_VIOLATION";
  readonly attemptedPeerId: NodeId;
  readonly currentBondCount: number;
  readonly maxBonds: number;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when an incoming bond message is received. */
export interface BondMessageReceivedEvent {
  readonly type: "BOND_MESSAGE_RECEIVED";
  readonly message: BondMessage;
  readonly timestamp: UnixTimestamp;
}

// ─── Transport Events ───────────────────────────────────────────────

/** Emitted when a new peer is discovered on the mesh. */
export interface PeerDiscoveredEvent {
  readonly type: "PEER_DISCOVERED";
  readonly peer: DiscoveredPeer;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a message is successfully transmitted. */
export interface TransmitCompleteEvent {
  readonly type: "TRANSMIT_COMPLETE";
  readonly bytesSent: number;
  readonly medium: TransportMedium;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when fragmented data is fully reassembled. */
export interface ReassemblyCompleteEvent {
  readonly type: "REASSEMBLY_COMPLETE";
  readonly totalBytes: number;
  readonly fragmentCount: number;
  readonly timestamp: UnixTimestamp;
}

/** Emitted when a transport medium encounters an error. */
export interface TransportErrorEvent {
  readonly type: "TRANSPORT_ERROR";
  readonly medium: TransportMedium;
  readonly error: string;
  readonly timestamp: UnixTimestamp;
}

// ─── Union Types ────────────────────────────────────────────────────

/** All identity-related events. */
export type IdentityEvent =
  | IdentityProvisionedEvent
  | IdentityRotatedEvent
  | IdentityMigratedEvent
  | IdentityStatusChangedEvent
  | IdentityRecoveredEvent;

/** All state-related events. */
export type StateEvent =
  | StateChangedEvent
  | ScopeTierChangedEvent
  | RemoteStateReceivedEvent
  | PeerOfflineEvent
  | CoherenceChangedEvent;

/** All vault-related events. */
export type VaultEvent =
  | VaultLayerCreatedEvent
  | VaultLayerWrittenEvent
  | VaultAccessGrantedEvent
  | VaultAccessRevokedEvent
  | VaultCapacityWarningEvent;

/** All bond-related events. */
export type BondEvent =
  | BondFormedEvent
  | BondTrustChangedEvent
  | CareScoreUpdatedEvent
  | BondTerminatedEvent
  | BondStatusChangedEvent
  | TopologyViolationEvent
  | BondMessageReceivedEvent;

/** All transport-related events. */
export type TransportEvent =
  | PeerDiscoveredEvent
  | TransmitCompleteEvent
  | ReassemblyCompleteEvent
  | TransportErrorEvent;

/** Union of all Node Zero events. */
export type NodeZeroEvent =
  | IdentityEvent
  | StateEvent
  | VaultEvent
  | BondEvent
  | TransportEvent;

/**
 * Extract the event type string literal from a NodeZeroEvent.
 */
export type NodeZeroEventType = NodeZeroEvent["type"];

/**
 * Map from event type string to the corresponding event interface.
 */
export type NodeZeroEventMap = {
  IDENTITY_PROVISIONED: IdentityProvisionedEvent;
  IDENTITY_ROTATED: IdentityRotatedEvent;
  IDENTITY_MIGRATED: IdentityMigratedEvent;
  IDENTITY_STATUS_CHANGED: IdentityStatusChangedEvent;
  IDENTITY_RECOVERED: IdentityRecoveredEvent;
  STATE_CHANGED: StateChangedEvent;
  SCOPE_TIER_CHANGED: ScopeTierChangedEvent;
  REMOTE_STATE_RECEIVED: RemoteStateReceivedEvent;
  PEER_OFFLINE: PeerOfflineEvent;
  COHERENCE_CHANGED: CoherenceChangedEvent;
  VAULT_LAYER_CREATED: VaultLayerCreatedEvent;
  VAULT_LAYER_WRITTEN: VaultLayerWrittenEvent;
  VAULT_ACCESS_GRANTED: VaultAccessGrantedEvent;
  VAULT_ACCESS_REVOKED: VaultAccessRevokedEvent;
  VAULT_CAPACITY_WARNING: VaultCapacityWarningEvent;
  BOND_FORMED: BondFormedEvent;
  BOND_TRUST_CHANGED: BondTrustChangedEvent;
  CARE_SCORE_UPDATED: CareScoreUpdatedEvent;
  BOND_TERMINATED: BondTerminatedEvent;
  BOND_STATUS_CHANGED: BondStatusChangedEvent;
  TOPOLOGY_VIOLATION: TopologyViolationEvent;
  BOND_MESSAGE_RECEIVED: BondMessageReceivedEvent;
  PEER_DISCOVERED: PeerDiscoveredEvent;
  TRANSMIT_COMPLETE: TransmitCompleteEvent;
  REASSEMBLY_COMPLETE: ReassemblyCompleteEvent;
  TRANSPORT_ERROR: TransportErrorEvent;
};
