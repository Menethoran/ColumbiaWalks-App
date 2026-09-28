#!/usr/bin/env python3
"""Regression cases for the patch-ending-in-zero rule, including iOS guards."""
import importlib.util
import os
from pathlib import Path
import subprocess
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('distribution', HERE / 'verify-distribution.py')
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)

class DistributionTests(unittest.TestCase):
    def test_every_patch_ending_in_zero_is_internal_only(self):
        for version in ('3.17.0','3.17.10','3.17.20','3.17.100','4.0.30'):
            self.assertEqual(version, policy.verify('internal',version))
            for channel in ('public','external'):
                with self.assertRaisesRegex(ValueError,'INTERNAL TEST ONLY'): policy.verify(channel,version)
    def test_other_plain_patch_versions_remain_public_candidates(self):
        for version in ('3.17.1','3.17.11','3.17.101','4.0.9'):
            for channel in ('internal','public','external'): self.assertEqual(version,policy.verify(channel,version))
    def test_no_suffix_or_leading_zero_can_bypass_the_rule(self):
        for version in ('3.17.10-beta','3.17.010','3.17.0+test','3.17','3.17.10.1'):
            with self.assertRaises(ValueError): policy.verify('public',version)
    def test_source_cannot_be_overridden_with_a_public_artifact_version(self):
        result=subprocess.run(['python3',str(HERE/'verify-distribution.py'),'--channel','public','--version','3.17.11'],capture_output=True)
        self.assertNotEqual(0,result.returncode)
    def test_ios_internal_identity_and_distribution(self):
        script=HERE.parents[1]/'ios/scripts/check-internal-build.sh'
        for version in ('3.17.0','3.17.10','3.17.20','3.17.100'):
            base=dict(os.environ,MARKETING_VERSION=version,CONFIGURATION='Debug',CW_DISTRIBUTION_CHANNEL='internal',PRODUCT_BUNDLE_IDENTIFIER='org.columbiawalks.app.internal')
            self.assertEqual(0,subprocess.run(['sh',str(script)],env=base,capture_output=True).returncode)
            for changes in ({'CONFIGURATION':'Release'},{'CW_DISTRIBUTION_CHANNEL':'external'},{'PRODUCT_BUNDLE_IDENTIFIER':'org.columbiawalks.app'}):
                self.assertNotEqual(0,subprocess.run(['sh',str(script)],env=base|changes,capture_output=True).returncode)

if __name__=='__main__': unittest.main()
