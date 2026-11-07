package com.kashnode.app.ui.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.WindowInsets

@Composable
fun SettingsScreen(
 viewModel:SettingsViewModel,
 onBack:()->Unit,
 onRequestPhoneStatePermission:()->Unit
) {
 var refresh by remember { mutableIntStateOf(0) }
 val hasPermission=viewModel.hasPhoneStatePermission()
 val sims=remember(refresh,hasPermission) { viewModel.availableSims() }
 var selectedCallSim by remember(refresh) { mutableIntStateOf(viewModel.selectedCallSimSlot()) }
 var smsSelection by remember(refresh) { mutableIntStateOf(viewModel.smsMonitoringSelection()) }
 var autoDial by remember(refresh) { mutableStateOf(viewModel.autoDialEnabled()) }

 Column(
  modifier=Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
  verticalArrangement=Arrangement.spacedBy(12.dp)
 ) {
  TextButton(onClick=onBack) { Text("Back") }
  Text("Device Settings",style=MaterialTheme.typography.headlineSmall)
  HorizontalDivider()
  Text("Primary Outbound Call SIM",style=MaterialTheme.typography.titleMedium)
  if(!hasPermission) {
   Text("Phone permission is required to discover SIM cards and choose the outbound line.")
   Button(onClick=onRequestPhoneStatePermission) { Text("Grant phone permission") }
  } else if(sims.isEmpty()) {
   Text("No active SIM subscriptions were found. Insert a SIM and refresh.")
   TextButton(onClick={refresh++}) { Text("Refresh SIM list") }
  } else {
   sims.forEach { sim ->
    Row(
     modifier=Modifier.fillMaxWidth().clickable { selectedCallSim=sim.slotIndex;viewModel.selectCallSimSlot(sim.slotIndex) }.padding(vertical=6.dp),
     verticalAlignment=Alignment.CenterVertically
    ) {
     RadioButton(selected=selectedCallSim==sim.slotIndex,onClick={selectedCallSim=sim.slotIndex;viewModel.selectCallSimSlot(sim.slotIndex)})
     Column(Modifier.weight(1f)) {
      Text(sim.label,style=MaterialTheme.typography.bodyLarge)
      Text("Subscription ID: ${sim.subscriptionId}",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
     }
    }
   }
   TextButton(onClick={refresh++}) { Text("Refresh SIM list") }
  }
  HorizontalDivider()
  Text("SMS Monitoring SIM",style=MaterialTheme.typography.titleMedium)
  listOf(0 to "SIM 1",1 to "SIM 2",2 to "Both SIMs").forEach { (value,label) ->
   Row(
    modifier=Modifier.fillMaxWidth().clickable { smsSelection=value;viewModel.selectSmsMonitoring(value) }.padding(vertical=4.dp),
    verticalAlignment=Alignment.CenterVertically
   ) {
    RadioButton(selected=smsSelection==value,onClick={smsSelection=value;viewModel.selectSmsMonitoring(value)})
    Text(label)
   }
  }
  HorizontalDivider()
  Row(modifier=Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween) {
   Column(Modifier.weight(1f)) {
    Text("Auto-Dial Mode",style=MaterialTheme.typography.titleMedium)
    Text(if(autoDial)"Pending order calls dial automatically." else "Manual confirmation is required before dialing.",style=MaterialTheme.typography.bodySmall,color=MaterialTheme.colorScheme.onSurfaceVariant)
   }
   Switch(checked=autoDial,onCheckedChange={autoDial=it;viewModel.setAutoDialEnabled(it)})
  }
 }
}
