// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Offchain replay verification, recorded on Sepolia by the player.
/// The attestor is the Squeek Run service, not SqueekCore or its oracle.
contract SqueekRunScores {
    address public attestor;
    uint256 public constant REQUIRED_CHAIN_ID = 11155111;
    bytes32 public constant RESULT_TYPEHASH = keccak256("RunResult(address player,bytes32 challengeId,bytes32 rulesHash,bytes32 replayHash,bytes32 runId,uint32 score,uint32 ticks,bool completed,uint64 deadline)");
    bytes32 private constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    struct RunResult { address player; bytes32 challengeId; bytes32 rulesHash; bytes32 replayHash; bytes32 runId; uint32 score; uint32 ticks; bool completed; uint64 deadline; }
    struct Best { uint32 score; uint32 ticks; bool completed; }
    mapping(bytes32 => bool) public usedRunIds;
    mapping(address => mapping(bytes32 => mapping(bytes32 => Best))) public bestScores;
    mapping(address => uint256) public savedRuns;
    event RunSaved(address indexed player, bytes32 indexed challengeId, bytes32 indexed runId, bytes32 rulesHash, bytes32 replayHash, uint32 score, uint32 ticks, bool completed);
    error WrongChain(); error InvalidAttestor(); error WrongPlayer(); error Expired(); error InvalidResult(); error AlreadySaved(); error InvalidSignature();
    constructor(address signer) { if(block.chainid != REQUIRED_CHAIN_ID) revert WrongChain(); if(signer == address(0)) revert InvalidAttestor(); attestor = signer; }
    function domainSeparator() public view returns(bytes32) { return keccak256(abi.encode(DOMAIN_TYPEHASH,keccak256("SqueekRunScores"),keccak256("1"),block.chainid,address(this))); }
    function saveRun(RunResult calldata result, bytes calldata signature) external {
        if(block.chainid != REQUIRED_CHAIN_ID) revert WrongChain();
        if(result.player != msg.sender) revert WrongPlayer();
        if(block.timestamp > result.deadline) revert Expired();
        if(result.ticks == 0 || result.ticks > 7200 || result.score > 20000 || result.challengeId == bytes32(0) || result.runId == bytes32(0)) revert InvalidResult();
        if(usedRunIds[result.runId]) revert AlreadySaved();
        bytes32 payload=keccak256(abi.encode(RESULT_TYPEHASH,result.player,result.challengeId,result.rulesHash,result.replayHash,result.runId,result.score,result.ticks,result.completed,result.deadline));
        if(ECDSA.recover(keccak256(abi.encodePacked(hex"1901",domainSeparator(),payload)),signature) != attestor) revert InvalidSignature();
        usedRunIds[result.runId]=true; savedRuns[msg.sender]++;
        Best storage best=bestScores[msg.sender][result.challengeId][result.rulesHash];
        if(best.ticks == 0 || result.score > best.score || (result.score == best.score && result.ticks < best.ticks)) { best.score=result.score; best.ticks=result.ticks; best.completed=result.completed; }
        emit RunSaved(result.player,result.challengeId,result.runId,result.rulesHash,result.replayHash,result.score,result.ticks,result.completed);
    }
}
